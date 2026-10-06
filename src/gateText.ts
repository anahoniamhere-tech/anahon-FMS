/**
 * What the gate says when it refuses — in English and in Arabic (6 Oct 2026).
 *
 * AnaHon is an Arabic newsroom, and these are the sentences an editor actually reads when the
 * system says no. They lived only in English because they are policy sentences built inside
 * editorialGates.ts rather than interface strings, so the Arabic app showed English refusals.
 *
 * ONE ENTRY PER REFUSAL, translated at the source. Nothing is translated at render time: the
 * Arabic here is written against the handbook's own wording — «متتبّع التنوّع»، «التحقّق من
 * المعلومات»، «مدقّق المعلومات»، «الموافقتان»، «السياسة P3، البند 4.1».
 *
 * The English template must stay byte-identical to what the gate said before, because the server
 * sends these as error text and several check scripts match on them. `en` is the source of truth
 * for behaviour; `ar` is the source of truth for what an Arabic editor sees.
 *
 * `{0}`, `{1}`, `{2}` are values the gate fills in — a status, a seat, a field name. A value can
 * itself be a translatable word (a seat, a standard), so the caller may pass its own translator.
 */
export type Msg = { key: string; args: string[]; en: string };

export const GATE_TEXT: Record<string, { en: string; ar: string }> = {
  // ── Social posts (Policy P3 covers the networks exactly as it covers the website) ──────
  "social.no-piece": {
    en: "Every post carries a piece from the editorial register — Policy P3 covers Facebook and Instagram exactly as it covers the website, and all content is reviewed and approved before it is published. Create or pick the piece, and the post goes out when the piece is cleared.",
    ar: "كل منشور يحمل مادة من السجل التحريري — السياسة P3 تشمل فيسبوك وإنستغرام تمامًا كما تشمل الموقع، وكل محتوى يُراجَع ويُوافَق عليه قبل نشره. أنشئ المادة أو اخترها، ويخرج المنشور متى أُجيزت المادة.",
  },
  "social.retracted": {
    en: "That piece has been retracted — its posts were cancelled and it may not be promoted again (Policy P4).",
    ar: "هذه المادة مسحوبة — أُلغيت منشوراتها ولا يجوز الترويج لها مجددًا (السياسة P4).",
  },
  "social.rehearsal": {
    en: "That piece is a rehearsal — a walk-through of the chain, not a publication. Nothing from it goes to a social account.",
    ar: "هذه المادة بروفة — تمرين على مسار العمل وليست نشرًا. لا شيء منها يذهب إلى حساب اجتماعي.",
  },

  // ── Publication (Policy P3 §4.2 the two approvals, P4 the fact-check) ─────────────────
  "publish.status": {
    en: "Status is {0} — only Approved content can be published.",
    ar: "الحالة {0} — لا يُنشر إلا المحتوى الموافَق عليه.",
  },
  "publish.factcheck": {
    en: "Fact-check has not passed (Policy P4: fact-checked before publication).",
    ar: "لم يجتز التحقّق من المعلومات (السياسة P4: التحقّق من المعلومات قبل النشر).",
  },
  "publish.pm": {
    en: "Production Manager approval missing (Policy P3).",
    ar: "موافقة مدير الإنتاج غير مسجّلة (السياسة P3).",
  },
  "publish.pd": {
    en: "Programs Director approval missing (Policy P3).",
    ar: "موافقة مدير البرامج غير مسجّلة (السياسة P3).",
  },
  "publish.same-person": {
    en: "Both approvals are by the same person — Policy P3 requires the Production Manager AND the Programs Director.",
    ar: "الموافقتان من الشخص نفسه — تشترط السياسة P3 مدير الإنتاج ومدير البرامج معًا.",
  },
  "publish.no-label": {
    en: "No content label — say whether this is News, Commercial or Opinion (Policy P3: each content type must be clearly labelled).",
    ar: "لا تصنيف للمحتوى — حدّد إن كانت المادة خبرًا أم محتوى تجاريًا أم رأيًا (السياسة P3: يُوسَم كل نوع محتوى بوضوح).",
  },
  "publish.bad-label": {
    en: "\"{0}\" is not a content label Policy P3 defines ({1}).",
    ar: "«{0}» ليست من تصنيفات المحتوى التي تحدّدها السياسة P3 ({1}).",
  },
  "publish.commercial-disclosure": {
    en: "Commercial content must say who paid for it or what the relationship is (Policy P3: maintain transparency about any commercial relationships or sponsorships).",
    ar: "المحتوى التجاري يجب أن يذكر من دفع ثمنه أو ما طبيعة العلاقة (السياسة P3: الشفافية في أي علاقة تجارية أو رعاية).",
  },
  "publish.legal": {
    en: "Flagged for legal implications but no legal review recorded (Policy P3).",
    ar: "مُؤشَّر عليها بتبعات قانونية دون تسجيل مراجعة قانونية (السياسة P3).",
  },
  "publish.ai": {
    en: "AI was used on this item — confirm the AI-use watermark/disclaimer is on the published piece (transparency rule).",
    ar: "استُخدم الذكاء الاصطناعي في هذه المادة — أكّد وجود علامة أو تنويه استخدام الذكاء الاصطناعي على المادة المنشورة (قاعدة الشفافية).",
  },
  "publish.standard": {
    en: "Standard unmet: {0} (Policy P3).",
    ar: "معيار غير مستوفى: {0} (السياسة P3).",
  },

  // ── Rehearsals: the same separation, compared by seat instead of by person ────────────
  "clash.no-seat": {
    en: "No seat — stand in a seat with Act as… first.",
    ar: "لا مقعد — قف في مقعد عبر «العمل بصفة…» أولًا.",
  },
  "clash.author-factcheck": {
    en: "The {0} seat authored this rehearsal — name a different seat as fact-checker (Policy P4: the checker is not the author).",
    ar: "مقعد {0} هو من كتب هذه البروفة — سمِّ مقعدًا آخر مدقّقًا للمعلومات (السياسة P4: المدقّق ليس الكاتب).",
  },
  "clash.pass": {
    en: "Only the {0} seat can pass this — you are standing in {1}.",
    ar: "لا يجيزها إلا مقعد {0} — وأنت تقف في مقعد {1}.",
  },
  "clash.author-approve": {
    en: "The {0} seat authored this rehearsal — approve it from a different seat (§4.3).",
    ar: "مقعد {0} هو من كتب هذه البروفة — وافق عليها من مقعد آخر (البند 4.3).",
  },
  "clash.checker-approve": {
    en: "The {0} seat fact-checked this rehearsal — approve it from a different seat.",
    ar: "مقعد {0} هو من دقّق معلومات هذه البروفة — وافق عليها من مقعد آخر.",
  },
  "clash.other-approval": {
    en: "The {0} seat already holds the other approval — Policy P3 needs two different approvers, so use a different seat.",
    ar: "مقعد {0} يحمل الموافقة الأخرى أصلًا — تشترط السياسة P3 موافقَين مختلفَين، فاستخدم مقعدًا آخر.",
  },
  "seats.missing": {
    en: "Rehearsal: no seat recorded for the {0}.",
    ar: "بروفة: لا مقعد مسجّل لـ{0}.",
  },
  "seats.duplicate": {
    en: "Rehearsal: the {0} and the {1} were both the {2} seat — each step must be a different seat.",
    ar: "بروفة: {0} و{1} كانا في مقعد {2} نفسه — كل خطوة في مقعد مختلف.",
  },

  // ── The diversity tracker (Policy P3 §4.1 step 2) ─────────────────────────────────────
  "dv.none": {
    en: "The diversity tracker has not been filled in for this piece — the main subject, the women and men mentioned or quoted, any vulnerable group, and the women and men quoted as experts (Policy P3 §4.1).",
    ar: "لم يُملأ متتبّع التنوّع لهذه المادة — موضوعها الرئيسي، والنساء والرجال الذين ورد ذكرهم أو اقتُبس عنهم، وأي فئة من الفئات الأكثر هشاشة، والنساء والرجال المقتبَس عنهم كخبراء (السياسة P3، البند 4.1).",
  },
  "dv.subject": {
    en: "Diversity tracker: say who the piece is mainly about (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: حدّد عمّن تتحدّث المادة أساسًا (السياسة P3، البند 4.1).",
  },
  "dv.bad-subject": {
    en: "Diversity tracker: \"{0}\" is not one of the main-subject options (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: «{0}» ليست من خيارات الموضوع الرئيسي (السياسة P3، البند 4.1).",
  },
  "dv.record": {
    en: "Diversity tracker: record {0} — a number, \"yes\", or \"none\" (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: سجّل {0} — عددًا أو «نعم» أو «لا شيء» (السياسة P3، البند 4.1).",
  },
  "dv.bad-value": {
    en: "Diversity tracker: \"{0}\" is not a value for {1} — use a number, \"yes\" or \"none\" (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: «{0}» ليست قيمة صالحة لـ{1} — استخدم عددًا أو «نعم» أو «لا شيء» (السياسة P3، البند 4.1).",
  },
  "dv.groups": {
    en: "Diversity tracker: name any vulnerable group in the piece, or tick \"{0}\" to record that there is none (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: سمِّ أي فئة من الفئات الأكثر هشاشة في المادة، أو اختر «{0}» لتسجيل أنه لا توجد (السياسة P3، البند 4.1).",
  },
  "dv.bad-group": {
    en: "Diversity tracker: \"{0}\" is not one of the vulnerable groups the tracker records (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: «{0}» ليست من الفئات الأكثر هشاشة التي يسجّلها المتتبّع (السياسة P3، البند 4.1).",
  },
  "dv.none-combined": {
    en: "Diversity tracker: \"{0}\" cannot be combined with a group (Policy P3 §4.1).",
    ar: "متتبّع التنوّع: لا يمكن الجمع بين «{0}» وأي فئة (السياسة P3، البند 4.1).",
  },
};

const fill = (template: string, args: string[]) =>
  template.replace(/\{(\d+)\}/g, (whole, i) => (args[Number(i)] ?? whole));

/** Build a refusal: English text for the server and the checks, key and args kept for the screen. */
export function m(key: string, ...args: (string | null | undefined)[]): Msg {
  const a = args.map(x => String(x ?? ""));
  const entry = GATE_TEXT[key];
  // An unknown key is a programming error, and silence would ship an empty refusal — which reads
  // to an editor as "no reason given" and to a reviewer as a gate that passed.
  if (!entry) throw new Error(`gateText: no entry for "${key}"`);
  return { key, args: a, en: fill(entry.en, a) };
}

/**
 * The sentence in one language. `tr` translates the VALUES the gate filled in — a seat, a status,
 * a standard's name — which are themselves interface words the app already translates.
 */
export function say(lang: string, msg: Msg, tr: (s: string) => string = s => s): string {
  const entry = GATE_TEXT[msg.key];
  if (!entry) return msg.en;
  const args = lang === "ar" ? msg.args.map(tr) : msg.args;
  return fill(lang === "ar" ? entry.ar : entry.en, args);
}

/** Every key that has no Arabic — empty when the gate can speak Arabic throughout. */
export const untranslated = (): string[] =>
  Object.entries(GATE_TEXT).filter(([, v]) => !v.ar || !/[؀-ۿ]/.test(v.ar)).map(([k]) => k);
