/**
 * One place for every explanation the system gives.
 *
 * Each entry is a question and its answer, in English and Arabic. The same list feeds
 * the ⓘ marks beside buttons (by id) and the Help & Q&A page (all of them, searchable),
 * so a button never explains itself differently from the handbook page.
 *
 * Adding one: append an object here. Nothing else to wire.
 */
export type HelpEntry = {
  id: string;
  area: "Money" | "Buying" | "Editorial" | "Website" | "People" | "Seats & approvals" | "Records";
  q: { en: string; ar: string };
  a: { en: string; ar: string };
};

export const HELP: HelpEntry[] = [
  // ---- Seats & approvals -------------------------------------------------------
  {
    id: "acting-as", area: "Seats & approvals",
    q: { en: "What does “Act as…” do?", ar: "ماذا يفعل زر «التصرّف بصفة…»؟" },
    a: {
      en: "It lets the Executive Director stand in a seat that nobody fills yet, such as Chief Editor or Production Team Leader. Every action taken while standing in a seat is recorded under your own name and the seat, so the record never suggests two people were involved. An amber bar stays on screen until you press Stop.",
      ar: "يتيح للمدير التنفيذي أن يشغل مقعداً شاغراً، مثل رئيس التحرير أو قائد فريق الإنتاج. كل إجراء يُتّخذ أثناء شغل المقعد يُسجَّل باسمك وباسم المقعد معاً، فلا يوحي السجل أبداً بوجود شخصين. يبقى الشريط الكهرماني ظاهراً حتى تضغط «إيقاف».",
    },
  },
  {
    id: "two-approvers", area: "Seats & approvals",
    q: { en: "Why does publishing need two approvals?", ar: "لماذا يحتاج النشر إلى موافقتين؟" },
    a: {
      en: "Policy 002 requires two different approvers before a piece goes public: the Production Manager slot and the Programme Director slot. One person may not fill both from one account. Until the Chief Editor is hired, the Executive Director fills the vacant slot through “Act as…”, and the log shows it.",
      ar: "تشترط السياسة 002 موافقتين مختلفتين قبل النشر: مقعد مدير الإنتاج ومقعد مدير البرامج. لا يجوز لشخص واحد أن يشغل المقعدين من حساب واحد. إلى أن يُعيَّن رئيس التحرير، يشغل المدير التنفيذي المقعد الشاغر عبر «التصرّف بصفة…» ويظهر ذلك في السجل.",
    },
  },
  {
    id: "program-director-seat", area: "Seats & approvals",
    q: { en: "Who is the “Program Director”? Our title is Executive Director.", ar: "من هو «مدير البرنامج»؟ لقبنا هو المدير التنفيذي." },
    a: {
      en: "The policies name the approving seat “Program Director”, and the system keeps that name for its permission rules so old records stay readable. The person in that seat is the Executive Director. Documents the system prints say Executive Director.",
      ar: "تسمّي السياسات مقعد الموافقة «مدير البرنامج»، ويحتفظ النظام بهذا الاسم في قواعد الصلاحيات كي تبقى السجلات القديمة مقروءة. الشخص في هذا المقعد هو المدير التنفيذي، والمستندات التي يطبعها النظام تكتب «المدير التنفيذي».",
    },
  },
  // ---- Money -------------------------------------------------------------------
  {
    id: "expense-lifecycle", area: "Money",
    q: { en: "What are the steps of a payment request?", ar: "ما هي مراحل طلب الدفع؟" },
    a: {
      en: "Submitted → Finance review → Approved → Paid → Posted. Anyone with access raises it. Finance can flag it for review. The director approves or returns it. Finance pays it from a named bank account, then posts it to the ledger. Each step is a button that appears only to the seat allowed to press it.",
      ar: "مُقدَّم ← مراجعة مالية ← موافَق عليه ← مدفوع ← مُرحَّل. يرفعه أي شخص لديه صلاحية. يمكن للمالية وضع علامة للمراجعة. يوافق المدير أو يعيده. تدفعه المالية من حساب مصرفي محدد ثم ترحّله إلى دفتر الأستاذ. كل مرحلة زر يظهر فقط للمقعد المخوّل بالضغط عليه.",
    },
  },
  {
    id: "expense-finance-review", area: "Money",
    q: { en: "What does “Flag for finance review” mean?", ar: "ماذا يعني «وضع علامة للمراجعة المالية»؟" },
    a: {
      en: "It parks the request under Finance Review so the Finance Officer checks the evidence, the budget line and the tax position before the director sees it. Use it when a receipt is missing, the vendor is new, or the amount does not match the quote.",
      ar: "يضع الطلب تحت «المراجعة المالية» كي يتحقق المسؤول المالي من الإثباتات وبند الموازنة والوضع الضريبي قبل أن يراه المدير. استخدمه عند غياب الإيصال، أو عندما يكون المورّد جديداً، أو عندما لا يطابق المبلغ عرض السعر.",
    },
  },
  {
    id: "expense-approve", area: "Money",
    q: { en: "What happens when I press Approve?", ar: "ماذا يحدث عندما أضغط «موافقة»؟" },
    a: {
      en: "The request becomes a commitment against its budget line and an accrual entry is written in the ledger. It is not paid yet; Finance pays it in the next step. Return sends it back to the person who raised it with your note, and releases the commitment.",
      ar: "يصبح الطلب التزاماً على بند الموازنة ويُقيَّد استحقاق في دفتر الأستاذ. لم يُدفع بعد؛ تدفعه المالية في الخطوة التالية. «إعادة» تُرجعه إلى من رفعه مع ملاحظتك وتحرّر الالتزام.",
    },
  },
  {
    id: "cash-150", area: "Money",
    q: { en: "Why can’t I pay this in cash?", ar: "لماذا لا أستطيع دفع هذا نقداً؟" },
    a: {
      en: "Policy 4.4.2: cash payments above USD 150 need the director’s approval recorded first. Approve the request, then settle it. Below USD 150, petty cash is allowed with a receipt.",
      ar: "السياسة 4.4.2: المدفوعات النقدية التي تتجاوز 150 دولاراً تحتاج إلى موافقة المدير مسجَّلة أولاً. وافق على الطلب ثم سدّده. دون 150 دولاراً، يُسمح بالنثريات مع إيصال.",
    },
  },
  {
    id: "expense-post", area: "Money",
    q: { en: "What does “Post to ledger” do?", ar: "ماذا يفعل «الترحيل إلى دفتر الأستاذ»؟" },
    a: {
      en: "It moves the paid request from committed to actual on its budget line and writes the final ledger entry against the bank or cash account it was paid from. After posting, the request is closed and appears in the financial reports.",
      ar: "ينقل الطلب المدفوع من «ملتزَم به» إلى «فعلي» على بند موازنته ويكتب القيد النهائي على الحساب المصرفي أو النقدي الذي دُفع منه. بعد الترحيل يُقفل الطلب ويظهر في التقارير المالية.",
    },
  },
  {
    id: "bank-import", area: "Money",
    q: { en: "How do bank statements get into the system?", ar: "كيف تدخل كشوف الحساب المصرفي إلى النظام؟" },
    a: {
      en: "Monthly, from the BLOM eBanking PDF. The lines are entered against the two accounts and the balance is set to the bank’s closing figure. Lines still pending at the bank are marked pending and do not count in balances until they post. The statement PDF is filed under General › Bank Statements in the vault.",
      ar: "شهرياً، من ملف PDF لكشف حساب بنك لبنان والمهجر الإلكتروني. تُدخل الأسطر على الحسابين ويُضبط الرصيد على الرقم الختامي للبنك. الأسطر التي لا تزال معلّقة لدى البنك تُعلَّم «معلّقة» ولا تُحتسب في الأرصدة حتى تُقيَّد. يُحفظ ملف الكشف في الخزنة تحت «عام › كشوف الحساب».",
    },
  },
  // ---- Buying ------------------------------------------------------------------
  {
    id: "procurement-300", area: "Buying",
    q: { en: "Why does a request above USD 300 refuse to submit?", ar: "لماذا يرفض طلب يتجاوز 300 دولار الإرسال؟" },
    a: {
      en: "Policy 7.2: purchases above USD 300 need three quotes compared and approved first, or a written single-source waiver. Go to Quotes & bids, lodge the comparison, have it approved, then raise the payment request and pick that comparison as its authority.",
      ar: "السياسة 7.2: المشتريات التي تتجاوز 300 دولار تحتاج أولاً إلى مقارنة ثلاثة عروض والموافقة عليها، أو إلى إعفاء مكتوب من المصدر الوحيد. اذهب إلى «العروض والمناقصات»، سجّل المقارنة، احصل على الموافقة، ثم ارفع طلب الدفع واختر تلك المقارنة مرجعاً له.",
    },
  },
  {
    id: "procurement-approve", area: "Buying",
    q: { en: "What does approving a bid comparison do?", ar: "ماذا تفعل الموافقة على مقارنة العروض؟" },
    a: {
      en: "It records which supplier was chosen and why, and unlocks payment requests above USD 300 on that project. It does not create a purchase order or pay anyone; the payment request does that.",
      ar: "تسجّل أي مورّد اختير ولماذا، وتفتح الباب لطلبات الدفع التي تتجاوز 300 دولار على ذلك المشروع. لا تُنشئ أمر شراء ولا تدفع لأحد؛ طلب الدفع يفعل ذلك.",
    },
  },
  {
    id: "vendor-tax", area: "Buying",
    q: { en: "Why is 7.5% deducted from a supplier’s payment?", ar: "لماذا يُقتطع 7.5٪ من دفعة مورّد؟" },
    a: {
      en: "Suppliers without a registered tax number are subject to withholding tax on services in Lebanon. The system computes it when the supplier has no tax ID on record and books it to the withholding account. Add the tax ID to the supplier to stop the deduction.",
      ar: "المورّدون الذين ليس لديهم رقم ضريبي مسجّل يخضعون لضريبة الاقتطاع على الخدمات في لبنان. يحتسبها النظام عندما لا يكون للمورّد رقم ضريبي مسجّل ويقيّدها في حساب الاقتطاع. أضف الرقم الضريبي إلى المورّد لإيقاف الاقتطاع.",
    },
  },
  // ---- Editorial ---------------------------------------------------------------
  {
    id: "content-approve", area: "Editorial",
    q: { en: "What is the difference between Approve and Publish?", ar: "ما الفرق بين «الموافقة» و«النشر»؟" },
    a: {
      en: "Approve fills one of the two approval slots on a piece. Publish is possible only once both slots are filled and the checks pass; it renders the piece to the website. A piece can be approved by one editor and still wait for the second.",
      ar: "«الموافقة» تملأ أحد مقعدي الموافقة على المادة. «النشر» لا يكون ممكناً إلا بعد امتلاء المقعدين ونجاح الفحوص؛ وهو يُخرج المادة إلى الموقع. يمكن أن يوافق محرّر واحد على المادة وتبقى بانتظار الثاني.",
    },
  },
  {
    id: "content-retract", area: "Editorial",
    q: { en: "Correction or retraction?", ar: "تصحيح أم سحب؟" },
    a: {
      en: "A correction changes a published piece and re-renders it, with the change noted. A retraction takes it off the website but keeps the record as Published with the reason and date, because Policy 005 forbids silent edits to the published record.",
      ar: "التصحيح يغيّر مادة منشورة ويعيد إخراجها مع تدوين التغيير. السحب يزيلها من الموقع لكنه يُبقي السجل بحالة «منشور» مع السبب والتاريخ، لأن السياسة 005 تمنع التعديل الصامت على السجل المنشور.",
    },
  },
  // ---- Website -----------------------------------------------------------------
  {
    id: "live-editor", area: "Website",
    q: { en: "How does the Live editor work?", ar: "كيف يعمل المحرّر المباشر؟" },
    a: {
      en: "It shows the real website from the editing server. Turn on Editing, click any text to change it, drop a picture from the panel onto any image, or drop a podcast, documentary or article onto the home widgets to pin it. Each change is written to the site’s files and the page reloads; what you see is what the files say.",
      ar: "يعرض الموقع الحقيقي من خادم التحرير. فعّل «التحرير»، انقر أي نص لتغييره، اسحب صورة من اللوحة إلى أي صورة، أو اسحب بودكاست أو فيلماً وثائقياً أو مقالاً إلى عناصر الصفحة الرئيسية لتثبيته. كل تغيير يُكتب في ملفات الموقع وتُعاد الصفحة؛ ما تراه هو ما تقوله الملفات.",
    },
  },
  {
    id: "publish-site", area: "Website",
    q: { en: "What does Publish on the Live editor do?", ar: "ماذا يفعل زر «نشر» في المحرّر المباشر؟" },
    a: {
      en: "It builds the whole public website from what you see and pushes it to the public host. Until the hosting server is bought, it builds only and nothing public changes. This is the only button that publishes anahon.org; every other Save updates the internal preview.",
      ar: "يبني الموقع العام كاملاً مما تراه ويدفعه إلى الخادم العام. إلى أن يُشترى خادم الاستضافة، يكتفي بالبناء ولا يتغيّر شيء علناً. هذا هو الزر الوحيد الذي ينشر anahon.org؛ كل «حفظ» آخر يحدّث المعاينة الداخلية.",
    },
  },
  {
    id: "archive-rebuild", area: "Website",
    q: { en: "What does “Publish to website” in the Archive do?", ar: "ماذا يفعل «النشر إلى الموقع» في الأرشيف؟" },
    a: {
      en: "It rebuilds the media library list the website reads, from the archive and your tag and caption edits. It does not publish anahon.org; that is the Live editor’s Publish.",
      ar: "يعيد بناء قائمة مكتبة الوسائط التي يقرأها الموقع، من الأرشيف ومن تعديلاتك على الوسوم والتعليقات. لا ينشر anahon.org؛ ذلك زر «نشر» في المحرّر المباشر.",
    },
  },
  // ---- People ------------------------------------------------------------------
  {
    id: "timesheet", area: "People",
    q: { en: "Why is my salary zero?", ar: "لماذا راتبي صفر؟" },
    a: {
      en: "Salary bases are zero until an active project funds the role. When a grant covers a post, its budget line sets the amount and the share of time, and payroll draws from that. This is how donors see exactly who was paid from which grant.",
      ar: "تكون أسس الرواتب صفراً إلى أن يموّل مشروع نشط الوظيفة. عندما تغطي منحة وظيفةً، يحدد بند موازنتها المبلغ ونسبة الوقت، ويُصرف الراتب منها. هكذا يرى المانحون بدقة من دُفع له ومن أي منحة.",
    },
  },
  // ---- Records -----------------------------------------------------------------
  {
    id: "vault", area: "Records",
    q: { en: "Where do uploaded documents go?", ar: "أين تذهب المستندات المرفوعة؟" },
    a: {
      en: "Into the document vault on the server, filed by project and category, with a reference number and a hash so a later copy can be checked against it. The vault is snapshotted every hour and copied off-site, encrypted, every night.",
      ar: "إلى خزنة المستندات على الخادم، مصنّفة حسب المشروع والفئة، مع رقم مرجعي وبصمة رقمية للتحقق من أي نسخة لاحقة. تُؤخذ لقطة للخزنة كل ساعة وتُنسخ مشفّرة خارج المكتب كل ليلة.",
    },
  },
  {
    id: "audit-log", area: "Records",
    q: { en: "What is in the audit log?", ar: "ما الذي يحويه سجل التدقيق؟" },
    a: {
      en: "Every action that changes money, content or access: who did it, when, what it touched, and, when the person was standing in a vacant seat, which seat. It cannot be edited from the interface.",
      ar: "كل إجراء يغيّر المال أو المحتوى أو الصلاحيات: من فعله، ومتى، وما الذي مسّه، وإذا كان الشخص يشغل مقعداً شاغراً، أي مقعد. لا يمكن تعديله من الواجهة.",
    },
  },
  {
    id: "my-desk", area: "Seats & approvals",
    q: { en: "What decides what is on My Desk?", ar: "ما الذي يحدد ما يظهر في «مكتبي»؟" },
    a: {
      en: "One rule per record status, kept in src/workflow.ts. A payment request that is Submitted waits on the director; once Approved it waits on Finance; a piece in Fact-Check waits on the named checker; a piece nobody is assigned to waits on the editors; a timeline step with no name waits on the programme's Project Officer, then the director. “Waiting on you” lists what is your turn, “Due this week” what is dated in the next seven days (or up to a week late) on any desk you can see, and “Seats I cover” (master account only) what is owed to a seat nobody holds yet — it hides an item as soon as someone else holds any seat that owns it; the statutory checklist is the master account's own until tasks get an assignee. A request you raised never asks you to approve it. Subscriptions appear a week before renewal; tools and contacts on the day. Nothing here is a separate task list — act on the record itself and it leaves the desk.",
      ar: "قاعدة واحدة لكل حالة سجل، محفوظة في src/workflow.ts. طلب الدفع «المُقدَّم» بانتظار المدير؛ وبعد الموافقة بانتظار المالية؛ والمادة «قيد التحقق» بانتظار المدقّق المسمّى؛ والمادة غير المكلَّف بها أحد بانتظار المحرّرين؛ وخطوة الجدول الزمني بلا اسم بانتظار مسؤول مشروع البرنامج ثم المدير. «بانتظارك» يعرض ما هو دورك، و«مستحق هذا الأسبوع» ما له تاريخ خلال سبعة أيام (أو متأخر بأسبوع على الأكثر) على أي مكتب تراه، و«المقاعد التي أشغلها» (الحساب الرئيسي فقط) ما هو مستحق على مقعد لا يشغله أحد بعد — ويختفي البند حالما يشغل شخص آخر أي مقعد يملكه؛ وقائمة الالتزامات النظامية عمل الحساب الرئيسي نفسه إلى أن تُسنَد المهام. الطلب الذي رفعته أنت لا يطلب منك الموافقة عليه أبداً. تظهر الاشتراكات قبل أسبوع من التجديد، والأدوات وجهات الاتصال في يومها. لا شيء هنا قائمة مهام منفصلة — نفّذ على السجل نفسه فيغادر المكتب.",
    },
  },
  {
    id: "doors", area: "Seats & approvals",
    q: { en: "What are the doors on My Desk?", ar: "ما هي الأبواب في «مكتبي»؟" },
    a: {
      en: "Every screen your seat opens, one tile each, grouped by the job it belongs to — the same doors as the sidebar, in the big view. A red number is what is waiting on you behind that door; a pink number is what is due this week on someone else's desk there. Tiles differ by seat: a Reporter sees the editorial desk, the Procurement officer the buying doors, the master account everything. Nothing is hidden behind a tile that the sidebar would show.",
      ar: "كل شاشة يفتحها مقعدك، بطاقة لكل واحدة، مجمّعة حسب العمل الذي تنتمي إليه — الأبواب نفسها الموجودة في الشريط الجانبي، في العرض الكبير. الرقم الأحمر هو ما ينتظرك خلف ذلك الباب؛ والرقم الوردي ما هو مستحق هذا الأسبوع على مكتب شخص آخر هناك. تختلف البطاقات حسب المقعد: المراسل يرى مكتب التحرير، ومسؤول المشتريات أبواب الشراء، والحساب الرئيسي كل شيء. لا شيء مخفي خلف بطاقة يعرضه الشريط الجانبي.",
    },
  },
  {
    id: "tasks", area: "Seats & approvals",
    q: { en: "How do tasks work?", ar: "كيف تعمل المهام؟" },
    a: {
      en: "A task is the one thing on the desk with no record of its own behind it — a filing, a call, a step somebody must simply do — so the director writes it on My Desk with a due date and, if it belongs to someone, their name. It then appears on that person's desk under “Waiting on you”, and only they (or the director) can tick it. A task with no name stays the director's own. Everything else on the desk arrives by doing the work on its own screen; tasks are the exception, not the pattern.",
      ar: "المهمة هي الشيء الوحيد على المكتب بلا سجل خاص خلفه — تقديم ورقة، اتصال، خطوة على أحدهم أن ينفّذها ببساطة — لذلك يكتبها المدير في «مكتبي» بتاريخ استحقاق، وباسم صاحبها إن كانت تخصّ أحداً. عندها تظهر على مكتب ذلك الشخص تحت «بانتظارك»، ولا يستطيع تعليمها كمنجزة سواه (أو المدير). والمهمة بلا اسم تبقى مهمة المدير نفسه. كل ما عدا ذلك يصل إلى المكتب من العمل على شاشته الخاصة؛ المهام هي الاستثناء لا القاعدة.",
    },
  },
  {
    id: "desk-feed", area: "Seats & approvals",
    q: { en: "How do I see my desk on my phone?", ar: "كيف أرى مكتبي على هاتفي؟" },
    a: {
      en: "Ask for a calendar address on My Desk and subscribe to it in the phone's calendar app (iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar). It carries one all-day entry for every dated thing that is your turn, refreshed about every hour, and nothing that belongs to anyone else. The address is the whole key — anyone holding it can read your desk — so it is shown once, never looked up again, and works only from inside the office network or over Tailscale. If it is ever shared by mistake, press Replace it: the old address stops working immediately and every device subscribed to it must be added again.",
      ar: "اطلب عنوان تقويم من «مكتبي» واشترك به في تطبيق التقويم على الهاتف (آيفون: الإعدادات ← التقويم ← الحسابات ← إضافة حساب ← أخرى ← إضافة تقويم مشترك). يحمل بنداً ليوم كامل لكل أمر مؤرّخ هو دورك، ويُحدَّث كل ساعة تقريباً، ولا يحمل شيئاً يخصّ غيرك. العنوان هو المفتاح كله — من يملكه يقرأ مكتبك — لذلك يُعرض مرة واحدة، ولا يُسترجع، ولا يعمل إلا من داخل شبكة المكتب أو عبر Tailscale. وإن شورك بالخطأ فاضغط «استبدله»: يتوقف القديم فوراً وعلى كل جهاز مشترك أن يُضاف من جديد.",
    },
  },
];

export const helpById = (id: string) => HELP.find(h => h.id === id);
