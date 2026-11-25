import { useCallback, useEffect, useState } from 'react';
import {
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import {
  ControlPanelConfig,
  MAX_EVENT_NOTICE_LENGTH,
} from '../types/seating';
import {
  constantTimeEqual,
  derivePasswordHashHex,
  generateSaltHex,
} from '../utils/passwordCrypto';

const CONFIG_COLLECTION = 'appConfig';
const CONFIG_DOC_ID = 'controlPanel';
const CONFIG_PATH = `${CONFIG_COLLECTION}/${CONFIG_DOC_ID}`;
const MIN_PASSWORD_LENGTH = 6;

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return Date.now();
}

export function useControlPanel(onNotify: (text: string) => void) {
  const [config, setConfig] = useState<ControlPanelConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    setConfigLoading(true);
    const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setConfig(null);
          setConfigLoading(false);
          return;
        }
        const data = snap.data();
        if (
          typeof data.passwordHash === 'string' &&
          typeof data.passwordSalt === 'string'
        ) {
          setConfig({
            passwordHash: data.passwordHash,
            passwordSalt: data.passwordSalt,
            reservationsLocked: Boolean(data.reservationsLocked),
            editRequiresAdmin:
              typeof data.editRequiresAdmin === 'boolean'
                ? data.editRequiresAdmin
                : true,
            eventNotice:
              typeof data.eventNotice === 'string' ? data.eventNotice : '',
            updatedAt: toMillis(data.updatedAt),
          });
        } else {
          setConfig(null);
        }
        setConfigLoading(false);
      },
      (error) => {
        setConfigLoading(false);
        try {
          handleFirestoreError(error, OperationType.GET, CONFIG_PATH);
        } catch (wrappedError) {
          setFatalError(
            wrappedError instanceof Error
              ? wrappedError
              : new Error(String(wrappedError))
          );
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const setupPassword = useCallback(
    async (password: string): Promise<{ ok: boolean; error?: string }> => {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return {
          ok: false,
          error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        };
      }
      if (config) {
        return {
          ok: false,
          error: 'El Panel de Control ya tiene una contraseña configurada.',
        };
      }

      setSavingConfig(true);
      try {
        const passwordSalt = generateSaltHex();
        const passwordHash = await derivePasswordHashHex(password, passwordSalt);
        await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID), {
          passwordHash,
          passwordSalt,
          reservationsLocked: false,
          editRequiresAdmin: true,
          eventNotice: '',
          updatedAt: serverTimestamp(),
        });
        setIsAdminUnlocked(true);
        onNotify('Contraseña del Panel de Control configurada correctamente');
        return { ok: true };
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.CREATE, CONFIG_PATH);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setFatalError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          }
          return {
            ok: false,
            error: 'No se pudo guardar la contraseña. Intenta de nuevo.',
          };
        }
      } finally {
        setSavingConfig(false);
      }
    },
    [config, onNotify]
  );

  const unlockWithPassword = useCallback(
    async (password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!config) {
        return {
          ok: false,
          error: 'Aún no hay una contraseña configurada.',
        };
      }
      if (!password) {
        return { ok: false, error: 'Ingresa la contraseña de administrador.' };
      }
      try {
        const candidateHash = await derivePasswordHashHex(
          password,
          config.passwordSalt
        );
        if (constantTimeEqual(candidateHash, config.passwordHash)) {
          setIsAdminUnlocked(true);
          onNotify('Panel de Control desbloqueado');
          return { ok: true };
        }
        return { ok: false, error: 'Contraseña incorrecta.' };
      } catch {
        return {
          ok: false,
          error: 'No se pudo verificar la contraseña en este navegador.',
        };
      }
    },
    [config, onNotify]
  );

  const lockPanel = useCallback(() => {
    setIsAdminUnlocked(false);
    onNotify('Panel de Control bloqueado');
  }, [onNotify]);

  const updateSettings = useCallback(
    async (next: {
      reservationsLocked: boolean;
      editRequiresAdmin: boolean;
      eventNotice: string;
    }): Promise<boolean> => {
      if (!isAdminUnlocked || !config) return false;
      const cleanNotice = next.eventNotice
        .trim()
        .slice(0, MAX_EVENT_NOTICE_LENGTH);

      setSavingConfig(true);
      try {
        await updateDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID), {
          reservationsLocked: Boolean(next.reservationsLocked),
          editRequiresAdmin: Boolean(next.editRequiresAdmin),
          eventNotice: cleanNotice,
          updatedAt: serverTimestamp(),
        });
        onNotify('Configuración del evento actualizada');
        return true;
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, CONFIG_PATH);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setFatalError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          } else {
            onNotify('No se pudieron guardar los ajustes del evento.');
          }
        }
        return false;
      } finally {
        setSavingConfig(false);
      }
    },
    [config, isAdminUnlocked, onNotify]
  );

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!isAdminUnlocked || !config) {
        return { ok: false, error: 'Desbloquea el Panel de Control primero.' };
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return {
          ok: false,
          error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        };
      }

      setSavingConfig(true);
      try {
        const currentHash = await derivePasswordHashHex(
          currentPassword,
          config.passwordSalt
        );
        if (!constantTimeEqual(currentHash, config.passwordHash)) {
          return { ok: false, error: 'La contraseña actual no coincide.' };
        }

        const nextSalt = generateSaltHex();
        const nextHash = await derivePasswordHashHex(newPassword, nextSalt);

        await updateDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID), {
          passwordHash: nextHash,
          passwordSalt: nextSalt,
          updatedAt: serverTimestamp(),
        });
        onNotify('Contraseña del Panel de Control actualizada');
        return { ok: true };
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, CONFIG_PATH);
        } catch (wrappedError) {
          const msg =
            wrappedError instanceof Error
              ? wrappedError.message
              : String(wrappedError);
          if (isQuotaExceededError(msg)) {
            setFatalError(
              wrappedError instanceof Error ? wrappedError : new Error(msg)
            );
          }
          return {
            ok: false,
            error: 'No se pudo actualizar la contraseña. Intenta de nuevo.',
          };
        }
      } finally {
        setSavingConfig(false);
      }
    },
    [config, isAdminUnlocked, onNotify]
  );

  const reservationsLocked = config?.reservationsLocked ?? false;
  const editRequiresAdmin = config?.editRequiresAdmin ?? false;
  const eventNotice = config?.eventNotice ?? '';

  return {
    config,
    configLoading,
    isConfigured: Boolean(config),
    isAdminUnlocked,
    savingConfig,
    reservationsLocked,
    editRequiresAdmin,
    eventNotice,
    setupPassword,
    unlockWithPassword,
    lockPanel,
    updateSettings,
    changePassword,
  };
}
