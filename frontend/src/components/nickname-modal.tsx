import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// 설정 화면에서 닉네임을 수정할 때 사용하는 독립 모달입니다.
// SettingsScreen의 ScrollView 밖에서 렌더링해서, 화면 스크롤/키보드 터치 처리와 모달 버튼 터치가 섞이지 않게 합니다.

const NICKNAME_MAX_LENGTH = 16;

const colors = {
  primary: '#5B7DBB',
  surface: '#FFFFFF',
  muted: '#E8EDF5',
  textPrimary: '#152538',
  textSecondary: '#39536B',
  textOnPrimary: '#FFFFFF',
  border: '#A9C3E6',
  error: '#8A2D2D',
};

type NicknameModalProps = {
  visible: boolean;
  currentNickname: string;
  onClose: () => void;
  onSave: (nickname: string) => Promise<void>;
};

export function NicknameModal({
  visible,
  currentNickname,
  onClose,
  onSave,
}: NicknameModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    // 모달을 열 때는 이미 설정 화면에 표시된 최신 닉네임을 입력창 기본값으로 사용합니다.
    setValue(currentNickname);
    setError(null);
  }, [currentNickname, visible]);

  const handleClose = () => {
    if (isSaving) {
      return;
    }

    onClose();
  };

  const handleSave = async () => {
    const trimmedNickname = value.trim();

    if (!trimmedNickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    if (trimmedNickname.length > NICKNAME_MAX_LENGTH) {
      setError(`닉네임은 ${NICKNAME_MAX_LENGTH}자 이하로 입력해주세요.`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedNickname);
      onClose();
    } catch {
      setError('닉네임 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={handleClose}>
          <TouchableOpacity activeOpacity={1} style={styles.box}>
            <View style={styles.header}>
              <Text style={styles.title}>닉네임 수정</Text>
              <TouchableOpacity onPress={handleClose} disabled={isSaving}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="닉네임을 입력해주세요"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isSaving}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.metaRow}>
              <Text style={[styles.helper, error ? styles.error : null]}>{error ?? ' '}</Text>
              <Text style={styles.helper}>
                {value.trim().length}/{NICKNAME_MAX_LENGTH}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={isSaving}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={isSaving}>
                <Text style={styles.saveText}>{isSaving ? '저장 중' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 24,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 24,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  close: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  error: {
    color: colors.error,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: colors.muted,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  saveText: {
    color: colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
