/**
 * The reading script for Saad's own Lebanese voice (drafts/anna-learns-arabic-plan.md §C).
 * Short, natural Lebanese sentences, written the way they are said, covering every Arabic sound
 * (ق as glottal stop, ث/ذ/ظ as spoken, the emphatics, ع/غ/ح/خ), numbers, dates, money, our names
 * and the loanwords Saad uses, and the kind of thing Anna says. Each session is 15–20 minutes.
 * More sessions are added after Saad has tried the first two.
 */
export const VOICE_SESSIONS: { id: number; title: string; lines: string[] }[] = [
  {
    id: 1,
    title: "Everyday talk",
    lines: [
      "أهلا وسهلا، كيفك اليوم؟",
      "صباح الخير، شو في عنا عالمكتب؟",
      "ما في شي مستعجل، بس في كم شغلة لازم نخلصن.",
      "بدي فنجان قهوة قبل ما نبلش.",
      "هلق بتصل فيك، خليك عالخط.",
      "بكرا الصبح منلتقى بالمكتب بطرابلس.",
      "الطقس حلو اليوم، بس في شوية هوا.",
      "ما تعتل هم، كل شي تحت السيطرة.",
      "يلا نبلش، الوقت عم يمرق.",
      "شو رأيك نأجل الاجتماع لبعد الضهر؟",
      "والله فكرة حلوة، بس خلينا نتأكد من الجدول.",
      "قلتلك مية مرة، القصة مش هيك.",
      "عم فكر بشي جديد للبرنامج.",
      "ضروري نحكي مع الفريق قبل الخميس.",
      "ظروف البلد صعبة، بس منكمل.",
      "الصيف كان طويل، والخريف وصل بسرعة.",
      "غريب كيف مرقت السنة.",
      "خلص، اتفقنا، منشوف بعض بكرا.",
      "عندي سؤال صغير عن الميزانية.",
      "ما بعرف إذا بلحق اليوم، بس رح حاول.",
      "حط الملف عالطاولة، بشوفو بعدين.",
      "ذكرني الساعة تلاتة بالتلفون.",
      "ثلاث أشخاص وصلوا، والباقي عالطريق.",
      "الطريق من بيروت لطرابلس أخدت ساعتين.",
      "الميناء كتير حلوة وقت المغرب.",
      "رحنا على حلبا وعكار الأسبوع الماضي.",
      "في ورشة تدريب بحلبا يوم السبت.",
      "خبرني إذا في شي تغير.",
      "صار لازم نرتب الأرشيف.",
      "هيدا الموضوع بدو قعدة طويلة.",
      "ما في مشكلة، بنرجع منحكي فيه.",
      "انبسطت كتير بالحلقة الأخيرة.",
      "الضيف كان منيح، والحديث كان عميق.",
      "صوت الميكروفون كان واضح هالمرة.",
      "بدنا نصور مقابلة جديدة الشهر الجاي.",
      "القصة بدها تفكير قبل ما نقرر.",
      "مظبوط، بس في تفصيل صغير ناقص.",
      "بصراحة، أنا مبسوط من النتيجة.",
      "شكرا كتير على تعبك.",
      "مع السلامة، منحكي بكرا.",
      "لحظة، عم شوف.",
      "تمام، بعتلك ياه هلق.",
      "إيه أكيد، ولا يهمك.",
      "لا، مش هيك قصدي.",
      "طيب، شو الخطوة الجاي؟",
      "خليني فكر شوي وبرجعلك.",
      "هيدي أول مرة بسمع فيها.",
      "كل شي ماشي حسب الخطة.",
      "في غلطة صغيرة بالرقم.",
      "صحح الاسم وابعتلي النسخة الجديدة.",
      "الاجتماع بلش متأخر عشر دقايق.",
      "ضعنا شوي بالطريق، بس وصلنا.",
      "غدا منبلش بكير.",
      "عطشان، في مي؟",
      "الشغل كتير اليوم، بس منيح.",
      "حاسس إنو الأسبوع طار.",
      "قدّيش الساعة هلق؟",
      "القاعة كانت مليانة ناس.",
      "زعلت شوي، بس هلق منيح.",
      "يعطيك العافية، شغل ممتاز.",
    ],
  },
  {
    id: 2,
    title: "Anna's answers: money, dates, names",
    lines: [
      "في عرض سعر واحد بعدو مرسل، لمارون أسمر.",
      "عرض السعر رقم ستة على ألفين وستة وعشرين.",
      "المبلغ سبع مية وخمسين دولار.",
      "تم تسجيل الإيصال رقم واحد.",
      "مكتبك فاضي اليوم، ما في شي بانتظارك.",
      "في مهمتين متأخرين، بدك شوفن؟",
      "التقرير لازم يتسلم قبل آخر الشهر.",
      "الموعد النهائي هو واحد وتلاتين أيار.",
      "المشروع بعدو ماشي، والميزانية تحت المراقبة.",
      "في سند دفع بانتظار الموافقة.",
      "المدير المالي لازم يوافق أول.",
      "هيدا القرار إلك، أنا بس بفتحلك الشاشة.",
      "فتحتلك صفحة عروض الأسعار.",
      "هيدي هي صفحة المشاريع.",
      "ما لقيت حدا بهيدا الاسم.",
      "قصدك زينة حمود؟",
      "لقيت أيمن حداد بجهات الاتصال.",
      "بدك سجلو كعميل جديد؟",
      "حضرتلك مسودة، أكد عليها لتنحفظ.",
      "المسودة ما انحفظت بعد.",
      "مؤسسة سمير قصير عندها مشروعين معنا.",
      "مؤسسة أصفري مولت البرنامج.",
      "مشروع حكي تغيير رح يبلش قريبا.",
      "برنامج أهالي المدينة بعدو بالتحضير.",
      "حلقة شو الوضع الجديدة جاهزة للنشر.",
      "آي كونتنت عندو زبون جديد.",
      "أنا هون عم تشتغل على خمس برامج.",
      "في ألف وخمس مية دولار بالصندوق.",
      "المصروف هالشهر تلاتة آلاف ومية وعشرين دولار.",
      "في فرق خمسة وتلاتين دولار بالكشف.",
      "سعر الصرف اليوم تسعة وتمانين ألف وخمس مية.",
      "الفاتورة بالليرة اللبنانية.",
      "بعتنا الدفعة التانية يوم الاتنين.",
      "الدفعة الأولى وصلت بالبنك.",
      "التاريخ سبعتعش أيلول ألفين وستة وعشرين.",
      "الساعة عشرة ونص الصبح.",
      "بعد تلات أيام بيخلص العقد.",
      "العقد لمدة ستة أشهر.",
      "في اجتماع بلجيكا بأول تشرين.",
      "الطاولة المستديرة بأربعة وعشرين أيلول.",
      "رح إبعتلك تذكير قبل بيوم.",
      "عدد المشاركين خمسة وعشرين.",
      "النسبة سبعين بالمية.",
      "الربع الأول كان منيح.",
      "الرقم التسلسلي آر سي صفر صفر اتنين.",
      "بدك تسمع التفاصيل ولا بس الملخص؟",
      "الملخص إنو كل شي بمكانو.",
      "في وثيقة ناقصة لهيدا المورد.",
      "لازم ينمضى نموذج التسجيل.",
      "الموظف عندو عقد سنوي.",
      "الإيميل وصل، بس ما في مرفقات.",
      "الميتينغ على زوم الساعة أربعة.",
      "اللابتوب بحاجة لتصليح.",
      "الكاميرا والميكروفونات بالمخزن.",
      "الفيديو صار جاهز على يوتيوب.",
      "البوست انشر على إنستغرام وفيسبوك.",
      "في خمس تعليقات جديدة.",
      "بدي ساعدك بشي تاني؟",
      "تمام يا سعد، إذا احتجت شي أنا هون.",
      "أهلا سعد، كيف بقدر ساعدك؟",
    ],
  },
];

/** The recording format the training wants: 16-bit mono PCM WAV at 22.05 kHz. */
export const VOICE_RATE = 22050;
export const VOICE_MIN_S = 0.6, VOICE_MAX_S = 20;
export const VOICE_CONSENT =
  "These recordings are my own voice. They are kept on AnaHon's NAS, used only to make Anna's Arabic voice, " +
  "and never shared, sold or used for anyone else. I can delete them at any time.";

/** Reads a WAV header: null unless it is the format above, and a sensible length. */
export function wavInfo(buf: Uint8Array): { seconds: number } | null {
  if (buf.length < 44) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || tag(12) !== "fmt ") return null;
  const format = v.getUint16(20, true), channels = v.getUint16(22, true), rate = v.getUint32(24, true), bits = v.getUint16(34, true);
  if (format !== 1 || channels !== 1 || rate !== VOICE_RATE || bits !== 16 || tag(36) !== "data") return null;
  const bytes = v.getUint32(40, true);
  if (bytes > buf.length - 44) return null;
  const seconds = bytes / (VOICE_RATE * 2);
  return seconds >= VOICE_MIN_S && seconds <= VOICE_MAX_S ? { seconds } : null;
}

/** Level checks on the samples (−1…1): too quiet, clipped, or noisy before speech starts. */
export function takeQuality(samples: Float32Array, rate = VOICE_RATE): { ok: boolean; warn: string[]; block: string[]; peak: number; rmsDb: number; noiseDb: number } {
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);
  let peak = 0, sum = 0, clipped = 0;
  for (const s of samples) { const a = Math.abs(s); if (a > peak) peak = a; sum += s * s; if (a >= 0.99) clipped++; }
  const rmsDb = db(Math.sqrt(sum / Math.max(1, samples.length)));
  const lead = samples.subarray(0, Math.min(samples.length, Math.round(rate * 0.25)));
  const noiseDb = db(Math.sqrt(lead.reduce((n, s) => n + s * s, 0) / Math.max(1, lead.length)));
  const block: string[] = [], warn: string[] = [];
  if (clipped > samples.length * 0.001) block.push("Too loud — it clipped. Move a little further from the phone.");
  if (rmsDb < -35) block.push("Too quiet. Hold the phone closer.");
  if (noiseDb > -45) warn.push("Some background noise before you spoke.");
  if (peak < 0.1) warn.push("Low level.");
  return { ok: !block.length, warn, block, peak, rmsDb, noiseDb };
}
