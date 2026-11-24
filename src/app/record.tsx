import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Banner, type BannerTone } from '@/components/ui/Banner';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { Card } from '@/components/ui/Card';
import { ComboField } from '@/components/ui/ComboField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlowField } from '@/components/ui/GlowField';
import { GradientButton } from '@/components/ui/GradientButton';
import { HudBar } from '@/components/ui/HudBar';
import { Icon } from '@/components/ui/Icon';
import { OptionsManager } from '@/components/ui/OptionsManager';
import { Screen } from '@/components/ui/Screen';
import { strings } from '@/constants/strings';
import { useRecords } from '@/context/RecordsContext';
import { colors, MIN_TARGET, space } from '@/theme';
import type { PatientRecord, RecordFields } from '@/types/record';
import { dataErrorMessage } from '@/utils/dataErrors';
import { formatDateTime } from '@/utils/dates';
import { haptic } from '@/utils/haptics';
import { canonicalValue, cleanText, makeId } from '@/utils/text';

const { record, validation, list, confirm } = strings;

type FieldKey = 'fullName' | 'idNumber' | 'residence' | 'age' | 'doctor' | 'examType' | 'filmType';
type FieldErrors = Partial<Record<FieldKey, string>>;
type Section = 'patient' | 'exam';
/** The three type-or-choose fields, and which saved list each one uses. */
type ComboKey = 'doctor' | 'exam' | 'film';
const LIST_OF: Record<ComboKey, 'doctors' | 'examTypes' | 'filmTypes'> = { doctor: 'doctors', exam: 'examTypes', film: 'filmTypes' };

const SECTION_OF: Record<FieldKey, Section> = {
  fullName: 'patient',
  idNumber: 'patient',
  residence: 'patient',
  age: 'patient',
  doctor: 'exam',
  examType: 'exam',
  filmType: 'exam',
};
const FIELD_ORDER: FieldKey[] = ['fullName', 'idNumber', 'residence', 'age', 'doctor', 'examType', 'filmType'];

/** The page for a record: new when there is no `id`, otherwise changing (or deleting) that record. */
export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { status, getRecord } = useRecords();
  const [removed, setRemoved] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // After a delete the page slides away; show an empty dark page meanwhile instead of a "not found" flash.
  if (removed) {
    return (
      <Screen>
        <View style={styles.flex} />
      </Screen>
    );
  }

  if (id) {
    const existing = getRecord(id);
    if (!existing) {
      return (
        <Screen>
          <HudBar />
          <View style={styles.center}>
            {status === 'loading' ? (
              <BrandLoader size={32} color={colors.aqua} />
            ) : (
              <>
                <AppText variant="body" color={colors.textMuted} style={styles.centerText}>
                  {record.notFound}
                </AppText>
                <GradientButton variant="ghost" label={record.back} onPress={goBack} icon="chevron-left" iconPosition="start" />
              </>
            )}
          </View>
        </Screen>
      );
    }
    return <RecordForm key={existing.id} existing={existing} goBack={goBack} onRemoved={() => setRemoved(true)} />;
  }
  return <RecordForm goBack={goBack} onRemoved={() => setRemoved(true)} />;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionDot} />
      <AppText variant="hud" color={colors.aqua}>
        {text}
      </AppText>
    </View>
  );
}

/** A small "opsionale" tag shown inside an empty optional field. */
function OptionalTag() {
  return (
    <View style={styles.optional}>
      <AppText variant="hud" color={colors.textSubtle} style={styles.optionalText}>
        {record.optional}
      </AppText>
    </View>
  );
}

function RecordForm({ existing, goBack, onRemoved }: { existing?: PatientRecord; goBack: () => void; onRemoved: () => void }) {
  const { options, save, remove, updateOptions, setNotice } = useRecords();

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [idNumber, setIdNumber] = useState(existing?.idNumber ?? '');
  const [residence, setResidence] = useState(existing?.residence ?? '');
  const [age, setAge] = useState(existing ? String(existing.age) : '');
  const [doctor, setDoctor] = useState(existing?.referringDoctor ?? '');
  const [examType, setExamType] = useState(existing?.examType ?? '');
  const [filmType, setFilmType] = useState(existing?.filmType ?? '');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ tone: BannerTone; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openCombo, setOpenCombo] = useState<ComboKey | null>(null);
  const [managing, setManaging] = useState<ComboKey | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // A new record gets its id when the form opens and its time when "Ruaj" is first pressed. Both stay the same on a retry,
  // so a slow connection can never create the record twice.
  const [draftId] = useState(makeId);
  const draftAt = useRef<number | null>(null);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const sectionY = useRef<Record<Section, number>>({ patient: 0, exam: 0 });
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});

  const fullNameRef = useRef<TextInputInstance>(null);
  const idNumberRef = useRef<TextInputInstance>(null);
  const residenceRef = useRef<TextInputInstance>(null);
  const ageRef = useRef<TextInputInstance>(null);
  const doctorRef = useRef<TextInputInstance>(null);
  const examTypeRef = useRef<TextInputInstance>(null);
  const filmTypeRef = useRef<TextInputInstance>(null);
  const refs = { fullName: fullNameRef, idNumber: idNumberRef, residence: residenceRef, age: ageRef, doctor: doctorRef, examType: examTypeRef, filmType: filmTypeRef };

  function scrollToField(key: FieldKey) {
    const y = sectionY.current[SECTION_OF[key]] + (fieldY.current[key] ?? 0);
    // Wait for the keyboard to finish opening, then bring the field near the top.
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 110), animated: true }), Platform.OS === 'ios' ? 60 : 280);
  }

  function onFieldFocus(key: FieldKey, focused: boolean) {
    if (!focused) return;
    setOpenCombo(null);
    scrollToField(key);
  }

  const slot = (key: FieldKey, node: ReactNode) => (
    <View
      key={key}
      onLayout={(e: LayoutChangeEvent) => {
        fieldY.current[key] = e.nativeEvent.layout.y;
      }}>
      {node}
    </View>
  );

  const setOpen = (which: ComboKey) => (open: boolean) =>
    setOpenCombo((current) => (open ? which : current === which ? null : current));

  function clearError(key: FieldKey) {
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if (banner?.tone === 'error') setBanner(null);
  }

  /** Checks the form. Returns the cleaned values, or null after showing what is missing. */
  function validate(): RecordFields | null {
    const next: FieldErrors = {};
    const name = cleanText(fullName);
    if (name.split(' ').length < 2) next.fullName = validation.nameRequired;

    const ageText = age.trim();
    const ageNumber = Number(ageText);
    if (!ageText) next.age = validation.ageRequired;
    else if (!Number.isInteger(ageNumber) || ageNumber < 0 || ageNumber > 120) next.age = validation.ageInvalid;

    const exam = canonicalValue(examType, options.examTypes);
    if (!exam) next.examType = validation.examRequired;
    const film = canonicalValue(filmType, options.filmTypes);
    if (!film) next.filmType = validation.filmRequired;

    setErrors(next);
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) {
      setOpenCombo(null);
      refs[first].current?.focus();
      scrollToField(first);
      return null;
    }
    return {
      fullName: name,
      idNumber: cleanText(idNumber).toUpperCase(),
      residence: cleanText(residence),
      age: ageNumber,
      referringDoctor: canonicalValue(doctor, options.doctors),
      examType: exam,
      filmType: film,
    };
  }

  async function handleSave() {
    if (busy) return;
    setBanner(null);
    const fields = validate();
    if (!fields) {
      haptic.error();
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      // The date and time of the exam are taken now, when the record is saved ("when it is done").
      const at = draftAt.current ?? Date.now();
      draftAt.current = at;
      const saved = await save({ fields, existing, draft: existing ? undefined : { id: draftId, at } });
      haptic.success();
      setNotice(existing ? list.updated(saved.fullName) : list.saved(saved.fullName));
      goBack();
    } catch (e) {
      setBanner({ tone: 'error', message: dataErrorMessage(e, 'save') });
      haptic.error();
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(existing.id);
      haptic.success();
      setNotice(list.deleted(existing.fullName));
      setConfirming(false);
      onRemoved();
      goBack();
    } catch (e) {
      setDeleteError(dataErrorMessage(e, 'delete'));
      haptic.error();
      setDeleting(false);
    }
  }

  const managedKey = managing ? LIST_OF[managing] : 'examTypes';
  const managedTitle = managing === 'doctor' ? record.doctor : managing === 'film' ? record.filmType : record.examType;

  return (
    <Screen>
      <HudBar />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Not "on-drag": on the web that also fires for the automatic scroll that brings a field into view, which would
          // drop the focus after the first keystroke. iPhone's "interactive" only reacts to the person's own drag.
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          showsVerticalScrollIndicator={false}
          overScrollMode="never">
          <View style={styles.header}>
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={record.back} style={styles.back}>
              <Icon name="chevron-left" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerText}>
              <AppText variant="title">{existing ? record.editTitle : record.newTitle}</AppText>
              {existing ? (
                <View style={styles.when}>
                  <Icon name="clock" size={14} color={colors.aqua} />
                  <AppText variant="caption" color={colors.aqua}>
                    {record.doneAt(formatDateTime(existing.examAt))}
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" color={colors.textMuted}>
                  {record.newSubtitle}
                </AppText>
              )}
            </View>
          </View>

          {banner ? <Banner tone={banner.tone} message={banner.message} /> : null}

          <View
            onLayout={(e: LayoutChangeEvent) => {
              sectionY.current.patient = e.nativeEvent.layout.y;
            }}>
            <Card>
              <SectionLabel text={record.patientSection} />
              {slot(
                'fullName',
                <GlowField
                  ref={fullNameRef}
                  label={record.fullName}
                  icon="user"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    clearError('fullName');
                  }}
                  error={errors.fullName}
                  onFocusChange={(f) => onFieldFocus('fullName', f)}
                  editable={!busy}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => idNumberRef.current?.focus()}
                />,
              )}
              {slot(
                'idNumber',
                <GlowField
                  ref={idNumberRef}
                  label={record.idCard}
                  icon="id-card"
                  value={idNumber}
                  onChangeText={setIdNumber}
                  onFocusChange={(f) => onFieldFocus('idNumber', f)}
                  editable={!busy}
                  trailing={idNumber ? undefined : <OptionalTag />}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => residenceRef.current?.focus()}
                />,
              )}
              {slot(
                'residence',
                <GlowField
                  ref={residenceRef}
                  label={record.residence}
                  icon="map-pin"
                  value={residence}
                  onChangeText={setResidence}
                  onFocusChange={(f) => onFieldFocus('residence', f)}
                  editable={!busy}
                  trailing={residence ? undefined : <OptionalTag />}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => ageRef.current?.focus()}
                />,
              )}
              {slot(
                'age',
                <GlowField
                  ref={ageRef}
                  label={record.age}
                  icon="calendar"
                  value={age}
                  onChangeText={(text) => {
                    setAge(text.replace(/\D/g, '').slice(0, 3));
                    clearError('age');
                  }}
                  error={errors.age}
                  onFocusChange={(f) => onFieldFocus('age', f)}
                  editable={!busy}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={3}
                  autoComplete="off"
                  importantForAutofill="no"
                  textContentType="none"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => doctorRef.current?.focus()}
                />,
              )}
            </Card>
          </View>

          <View
            onLayout={(e: LayoutChangeEvent) => {
              sectionY.current.exam = e.nativeEvent.layout.y;
            }}>
            <Card>
              <SectionLabel text={record.examSection} />
              {slot(
                'doctor',
                <ComboField
                  ref={doctorRef}
                  label={record.doctor}
                  icon="stethoscope"
                  value={doctor}
                  onChangeText={setDoctor}
                  options={options.doctors}
                  open={openCombo === 'doctor'}
                  onOpenChange={setOpen('doctor')}
                  onManage={() => setManaging('doctor')}
                  onChosen={() => examTypeRef.current?.focus()}
                  extra={doctor ? undefined : <OptionalTag />}
                  onFocusChange={(f) => onFieldFocus('doctor', f)}
                />,
              )}
              {slot(
                'examType',
                <ComboField
                  ref={examTypeRef}
                  label={record.examType}
                  icon="activity"
                  value={examType}
                  onChangeText={(text) => {
                    setExamType(text);
                    clearError('examType');
                  }}
                  options={options.examTypes}
                  open={openCombo === 'exam'}
                  onOpenChange={setOpen('exam')}
                  onManage={() => setManaging('exam')}
                  onChosen={() => filmTypeRef.current?.focus()}
                  error={errors.examType}
                  onFocusChange={(f) => onFieldFocus('examType', f)}
                />,
              )}
              {slot(
                'filmType',
                <ComboField
                  ref={filmTypeRef}
                  label={record.filmType}
                  icon="film"
                  value={filmType}
                  onChangeText={(text) => {
                    setFilmType(text);
                    clearError('filmType');
                  }}
                  options={options.filmTypes}
                  open={openCombo === 'film'}
                  onOpenChange={setOpen('film')}
                  onManage={() => setManaging('film')}
                  onChosen={() => Keyboard.dismiss()}
                  error={errors.filmType}
                  onFocusChange={(f) => onFieldFocus('filmType', f)}
                />,
              )}
            </Card>
          </View>

          <View style={styles.actions}>
            <GradientButton
              label={existing ? record.saveChanges : record.save}
              loadingLabel={record.saving}
              loading={busy}
              icon="check"
              iconPosition="start"
              onPress={handleSave}
            />
            {existing ? (
              <GradientButton
                variant="danger"
                label={record.delete}
                icon="trash"
                iconPosition="start"
                disabled={busy}
                onPress={() => {
                  setDeleteError(null);
                  setConfirming(true);
                }}
              />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {managing ? (
        <OptionsManager
          title={managedTitle}
          values={options[managedKey]}
          onChange={(next) => updateOptions({ ...options, [managedKey]: next })}
          onClose={() => setManaging(null)}
        />
      ) : null}

      {confirming && existing ? (
        <ConfirmDialog
          title={confirm.deleteTitle}
          message={confirm.deleteText(existing.fullName)}
          confirmLabel={confirm.delete}
          busyLabel={confirm.deleting}
          cancelLabel={confirm.cancel}
          busy={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: 32 },
  centerText: { textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.aqua },
  optional: { paddingRight: 16, justifyContent: 'center', pointerEvents: 'none' },
  optionalText: { fontSize: 10 },
  actions: { gap: 22, marginTop: 6 },
});
