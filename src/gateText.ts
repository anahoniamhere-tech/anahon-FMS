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

  // ── Route refusals (phase 1, 6 Oct 2026) ──────────────────────────────────────────────
  // The 27 policy-citing refusals the editorial routes return, plus the permission refusals an
  // editor meets most. The ROUTE keeps sending `error` in English — the server stays language-free
  // so the audit record does too — and sends the key beside it for the screen to render.
  "route.bad-label": {
    en: "\"{0}\" is not a content label Policy P3 defines ({1}).",
    ar: "«{0}» ليست من تصنيفات المحتوى التي تحدّدها السياسة P3 ({1}).",
  },
  "route.bad-type": {
    en: "Content type must be one of: {0} (Policy P3).",
    ar: "نوع المحتوى يجب أن يكون أحد: {0} (السياسة P3).",
  },
  "route.bad-channels": {
    en: "Unknown channel(s): {0}. Policy P3 channels: {1}.",
    ar: "قنوات غير معروفة: {0}. قنوات السياسة P3: {1}.",
  },
  "route.rehearsal-master": {
    en: "Only the master account can start a rehearsal.",
    ar: "لا يبدأ البروفة إلا الحساب الرئيسي.",
  },
  "route.published-correct": {
    en: "Published content is a permanent record — issue a public correction instead (Policy P4).",
    ar: "المحتوى المنشور سجلّ دائم — أصدر تصحيحًا علنيًا بدلًا من تعديله (السياسة P4).",
  },
  "route.start-who": {
    en: "Only the assignee or an editor can start production.",
    ar: "لا يبدأ الإنتاج إلا المكلّف بالمادة أو محرّر.",
  },
  "route.submit-who": {
    en: "Only the assignee or an editor can submit for fact-check.",
    ar: "لا يرسل المادة إلى التحقّق من المعلومات إلا المكلّف بها أو محرّر.",
  },
  "route.checker-active": {
    en: "Name an active user as the fact-checker (Policy P4: assign a dedicated individual responsible for verifying the facts).",
    ar: "سمِّ مستخدمًا فعّالًا مدقّقًا للمعلومات (السياسة P4: تكليف شخص محدّد بالتحقّق من الوقائع).",
  },
  "route.checker-not-author": {
    en: "Policy P4 impartiality: the fact-checker must not be the author — assign someone other than {0}.",
    ar: "حياد السياسة P4: مدقّق المعلومات ليس كاتب المادة — كلّف شخصًا غير {0}.",
  },
  "route.name-source": {
    en: "Name the source (Policy P4: detailed records of all sources and verification steps).",
    ar: "سمِّ المصدر (السياسة P4: سجلّات تفصيلية لكل المصادر وخطوات التحقّق).",
  },
  "route.log-who": {
    en: "Only the assignee, the named fact-checker or an editor can log sources.",
    ar: "لا يسجّل المصادر إلا المكلّف بالمادة أو مدقّق المعلومات المسمّى أو محرّر.",
  },
  "route.pass-who": {
    en: "Only the named fact-checker can pass this item (Policy P4: independent review by the assigned individual).",
    ar: "لا يجيز هذه المادة إلا مدقّق المعلومات المسمّى (السياسة P4: مراجعة مستقلة من الشخص المكلّف).",
  },
  "route.pass-needs-source": {
    en: "Log at least one source or verification step first (Policy P4: detailed records of all sources and verification steps).",
    ar: "سجّل مصدرًا واحدًا أو خطوة تحقّق واحدة على الأقل أولًا (السياسة P4: سجلّات تفصيلية لكل المصادر وخطوات التحقّق).",
  },
  "route.return-who": {
    en: "Only the named fact-checker or an editor can return this item.",
    ar: "لا يعيد هذه المادة إلا مدقّق المعلومات المسمّى أو محرّر.",
  },
  "route.return-review-who": {
    en: "Only an editor can return content from editorial review.",
    ar: "لا يعيد المادة من المراجعة التحريرية إلا محرّر.",
  },
  "route.approve-who": {
    en: "Approval needs the Production Manager, the Programs Director or the master account (Policy P3).",
    ar: "الموافقة تحتاج مدير الإنتاج أو مدير البرامج أو الحساب الرئيسي (السياسة P3).",
  },
  "route.approve-author": {
    en: "You authored this item — a different officer must approve it (§4.3 segregation of duties).",
    ar: "أنت كاتب هذه المادة — يوافق عليها مسؤول آخر (البند 4.3: الفصل بين المهام).",
  },
  "route.approve-other-slot": {
    en: "You already hold the other approval — Policy P3 requires the Production Manager AND the Programs Director, two different people.",
    ar: "أنت تحمل الموافقة الأخرى أصلًا — تشترط السياسة P3 مدير الإنتاج ومدير البرامج معًا، وهما شخصان مختلفان.",
  },
  "route.legal-who": {
    en: "Recording a legal review needs an editor role.",
    ar: "تسجيل مراجعة قانونية يحتاج صفة محرّر.",
  },
  "route.legal-name": {
    en: "Name who performed the legal review (Policy P3: stories with potential legal implications are reviewed by the legal team).",
    ar: "سمِّ من أجرى المراجعة القانونية (السياسة P3: المواد ذات التبعات القانونية المحتملة يراجعها الفريق القانوني).",
  },
  "route.publish-who": {
    en: "Publishing needs the Production Manager, the Programs Director or the master account (Policy P3).",
    ar: "النشر يحتاج مدير الإنتاج أو مدير البرامج أو الحساب الرئيسي (السياسة P3).",
  },
  "route.cover-who": {
    en: "Only the working team can set this item's cover.",
    ar: "لا يضع صورة غلاف هذه المادة إلا فريق العمل عليها.",
  },
  "route.retract-who": {
    en: "Retracting needs an editor role.",
    ar: "سحب المادة يحتاج صفة محرّر.",
  },
  "route.retract-why": {
    en: "State why it is being retracted (public record, Policy P4).",
    ar: "اذكر سبب سحب المادة (سجلّ علني، السياسة P4).",
  },
  "route.correction-who": {
    en: "Issuing a correction needs an editor role.",
    ar: "إصدار تصحيح يحتاج صفة محرّر.",
  },
  "route.correction-what": {
    en: "State the nature of the error and the correction (Policy P4: public record with date and details).",
    ar: "اذكر طبيعة الخطأ ونصّ التصحيح (السياسة P4: سجلّ علني بالتاريخ والتفاصيل).",
  },
  "route.delete-who": {
    en: "Removing a content item needs an editor role.",
    ar: "حذف مادة من السجل يحتاج صفة محرّر.",
  },
  "route.delete-published": {
    en: "Published content is a permanent record and cannot be deleted — append a correction instead (Policy P4).",
    ar: "المحتوى المنشور سجلّ دائم لا يُحذف — أضف تصحيحًا بدلًا من ذلك (السياسة P4).",
  },
  "route.brainstorm-who": {
    en: "The idea desk is for editors and Project Officers — assignments come out of the editorial meetings (Policy P3).",
    ar: "مكتب الأفكار للمحرّرين ومسؤولي المشاريع — والتكليفات تخرج من الاجتماعات التحريرية (السياسة P3).",
  },
  "route.meeting-kind": {
    en: "Meeting kind must be Weekly Editorial or Daily Production (Policy P3).",
    ar: "نوع الاجتماع يجب أن يكون تحريريًا أسبوعيًا أو إنتاجيًا يوميًا (السياسة P3).",
  },
  "route.meeting-who": {
    en: "Recording a meeting needs an editor or Project Officer (Policy P3 participants).",
    ar: "تسجيل اجتماع يحتاج محرّرًا أو مسؤول مشاريع (المشاركون في السياسة P3).",
  },
  "route.studio-who": {
    en: "The studio is for the assignee, the fact-checker, Project Officers and editors.",
    ar: "الاستوديو للمكلّف بالمادة ومدقّق المعلومات ومسؤولي المشاريع والمحرّرين.",
  },
  "route.research-who": {
    en: "Research is for the assignee, the fact-checker, Project Officers and editors.",
    ar: "البحث للمكلّف بالمادة ومدقّق المعلومات ومسؤولي المشاريع والمحرّرين.",
  },
  "route.tracker-who": {
    en: "The tracker is filled by the piece's author, its fact-checker or an editor (Policy P3 §4.1).",
    ar: "يملأ متتبّع التنوّع كاتبُ المادة أو مدقّق معلوماتها أو محرّر (السياسة P3، البند 4.1).",
  },
  "route.review-who": {
    en: "The monthly review is the editors' (Policy P3 §4.3).",
    ar: "المراجعة الشهرية للمحرّرين (السياسة P3، البند 4.3).",
  },
  "route.package-who": {
    en: "Coverage packages are planned by the editors (Policy P3 §4.3).",
    ar: "حزم التغطية يخطّط لها المحرّرون (السياسة P3، البند 4.3).",
  },
  "route.draft-save-who": {
    en: "Only the working team can save drafts on this item.",
    ar: "لا يحفظ مسوّدات هذه المادة إلا فريق العمل عليها.",
  },
  "route.draft-delete-who": {
    en: "Only the working team can remove drafts on this item.",
    ar: "لا يحذف مسوّدات هذه المادة إلا فريق العمل عليها.",
  },
  "route.minutes-who": {
    en: "Processing minutes needs an editor or Project Officer (Policy P3 participants).",
    ar: "معالجة المحضر تحتاج محرّرًا أو مسؤول مشاريع (المشاركون في السياسة P3).",
  },
  "route.recording-who": {
    en: "Processing a recording needs an editor or Project Officer (Policy P3 participants).",
    ar: "معالجة تسجيل تحتاج محرّرًا أو مسؤول مشاريع (المشاركون في السياسة P3).",
  },
  "route.meeting-delete-who": {
    en: "Removing a meeting record needs an editor role.",
    ar: "حذف سجلّ اجتماع يحتاج صفة محرّر.",
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

/**
 * A server refusal in the reader's language. The response carries the English sentence in `error`
 * and, where the route has been converted, `errorKey` and `errorArgs` beside it. Falls back to the
 * English — so a route that has not been converted, or an older server, still reads correctly.
 */
export function sayResponse(lang: string, data: any, tr: (s: string) => string = s => s): string {
  const en = String(data?.error || "");
  const key = String(data?.errorKey || "");
  if (!key || !GATE_TEXT[key]) return en;
  return say(lang, { key, args: (data?.errorArgs || []).map(String), en }, tr);
}

/** Every key that has no Arabic — empty when the gate can speak Arabic throughout. */
export const untranslated = (): string[] =>
  Object.entries(GATE_TEXT).filter(([, v]) => !v.ar || !/[؀-ۿ]/.test(v.ar)).map(([k]) => k);
