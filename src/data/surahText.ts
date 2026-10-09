import { LocalizedText } from '../constants';

/**
 * The Qur'anic text of Ayatul Kursi and the three Quls, in one place.
 *
 * These four appeared twice — once in the Protection routine and once in the
 * Du'a catalogue — and the copies had drifted: three transliterations and two
 * meanings were truncated mid-verse on one side and complete on the other, so
 * which text you read depended on which screen you opened. Scripture cannot
 * have two versions in one app.
 *
 * Both entries now spread from here and keep their own ids, titles, benefits
 * and categories. Nothing was retyped: every value below was lifted from
 * whichever copy carried the complete text.
 *
 * `id` exists so the translation tooling — which addresses fields by item id —
 * can still find and write these, exactly as it does for a du'a.
 */
export interface SurahText {
  id: string;
  arabic: string;
  trn: LocalizedText;
  meaning: LocalizedText;
}

export const SURAH_TEXTS: Record<string, SurahText> = {
  ayatulKursi: {
    id: 'surah_ayatulKursi',
    arabic: 'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ\nلَا تَأْخُذُهُۥ سِنَةٌۭ وَلَا نَوْمٌۭ ۚ\nلَّهُۥ مَا فِى ٱلسَّمَـٰوَٰتِ وَمَا فِى ٱلْأَرْضِ ۗ\nمَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ ۚ\nيَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ\nوَلَا يُحِيطُونَ بِشَىْءٍۢ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ ۚ\nوَسِعَ كُرْسِيُّهُ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضَ ۖ\nوَلَا يَـُٔودُهُۥ حِفْظُهُمَا ۚ\nوَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ',
    trn: {
      en: 'Allahu la ilaha illa Huwa, Al-Hayyul-Qayyum.\nLa ta\'khudhuhu sinatun wa la nawm.\nLahu ma fis-samawati wa ma fil-ard.\nMan dhalladhi yashfa\'u \'indahu illa bi-idhnih.\nYa\'lamu ma bayna aydihim wa ma khalfahum, wa la yuhituna bi shay\'im-min \'ilmihi illa bima sha\'.\nWasi\'a kursiyyuhus-samawati wal-ard, wa la ya\'uduhu hifzuhuma, wa Huwal-\'Aliyyul-\'Azim.',
      bn: 'আল্লাহু লা ইলাহা ইল্লা হুয়াল-হাইয়্যুল-কাইয়্যূম।\nলা তা’খুযুহু সিনাতুন ওয়া লা নাওম।\nলাহু মা ফিস-সামাওয়াতি ওয়া মা ফিল-আরদ।\nমান যাল্লাযী ইয়াশফা’উ ইন্দাহু ইল্লা বি-ইযনিহ।\nইয়া’লামু মা বাইনা আইদীহিম ওয়া মা খালফাহুম, ওয়া লা ইউহীতূনা বিশাই’ইম মিন ইলমিহী ইল্লা বিমা শা’।\nওয়াসি’আ কুরসিয়্যুহুস-সামাওয়াতি ওয়াল-আরদ, ওয়া লা ইয়াউদুহু হিফযুহুমা, ওয়া হুয়াল-আলিয়্যুল-আযীম।'
    },
    meaning: {
      en: 'Allah! There is no deity except Him, the Ever-Living, the Sustainer of all existence.\nNeither drowsiness overtakes Him nor sleep.\nTo Him belongs whatever is in the heavens and whatever is on the earth.\nWho is it that can intercede with Him except by His permission?\nHe knows what is before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills.\nHis Kursi extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
      bn: 'আল্লাহ্‌, তিনি ছাড়া কোনো সত্য ইলাহ নেই। তিনি চিরঞ্জীব, সর্বসত্তার ধারক।\nতাঁকে তন্দ্রাও স্পর্শ করতে পারে না, নিদ্রাও নয়।\nআসমানসমূহে যা রয়েছে ও যমীনে যা রয়েছে সবই তাঁর।\nকে সে, যে তাঁর অনুমতি ব্যতীত তাঁর কাছে সুপারিশ করবে?\nতাদের সামনে ও পেছনে যা কিছু আছে তা তিনি জানেন। আর যা তিনি ইচ্ছে করেন তা ছাড়া তাঁর জ্ঞানের কোনো কিছুকেই তারা পরিবেষ্টন করতে পারে না।\nতাঁর ‘কুরসী’ আসমানসমূহ ও যমীনকে পরিব্যাপ্ত করে আছে; আর এ দুটোর রক্ষণাবেক্ষণ তাঁর জন্য বোঝা হয় না। আর তিনি সুউচ্চ সুমহান।'
    }
  },
  ikhlas: {
    id: 'surah_ikhlas',
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ\nاللَّهُ الصَّمَدُ\nلَمْ يَلِدْ وَلَمْ يُولَدْ\nوَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ',
    trn: {
      en: 'Qul Huwa Allahu Ahad.\nAllahus-Samad.\nLam yalid wa lam yulad.\nWa lam yakul-lahu kufuwan ahad.',
      bn: 'কুল হুয়াল্লাহু আহাদ।\nআল্লাহুস-সামাদ।\nলাম ইয়ালিদ ওয়া লাম ইউলাদ।\nওয়া লাম ইয়াকুল্লাহু কুফুওয়ান আহাদ।'
    },
    meaning: {
      en: 'Say, \'He is Allah, [who is] One.\nAllah, the Eternal Refuge.\nHe neither begets nor is born.\nNor is there to Him any equivalent.\'',
      bn: 'বলুন, তিনি আল্লাহ, একক।\nআল্লাহ অমুখাপেক্ষী।\nতিনি জন্ম দেননি এবং জন্মগ্রহণও করেননি।\nআর তাঁর সমতুল্য কেউ নেই।'
    }
  },
  falaq: {
    id: 'surah_falaq',
    arabic: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ\nمِن شَرِّ مَا خَلَقَ\nوَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ\nوَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ\nوَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    trn: {
      en: 'Qul a\'udhu bi rabbil-falaq.\nMin sharri ma khalaq.\nWa min sharri ghasiqin idha waqab.\nWa min sharrin-naffathati fil-\'uqad.\nWa min sharri hasidin idha hasad.',
      bn: 'কুল আউযু বিরব্বিল-ফালাক।\nমিন শাররি মা খালাক।\nওয়া মিন শাররি গাসিকিন ইযা ওয়াকাব।\nওয়া মিন শাররিন-নাফফাসাতি ফিল-উকাদ।\nওয়া মিন শাররি হাসিদিন ইযা হাসাদ।'
    },
    meaning: {
      en: 'Say, \'I seek refuge in the Lord of daybreak\nFrom the evil of that which He created,\nAnd from the evil of darkness when it settles,\nAnd from the evil of the blowers in knots,\nAnd from the evil of an envier when he envies.\'',
      bn: 'বলুন, ‘আমি আশ্রয় প্রার্থনা করছি ঊষার রবের\nতিনি যা সৃষ্টি করেছেন তার অনিষ্ট হতে,\nআর অনিষ্ট হতে রাতের অন্ধকারের, যখন তা গভীর হয়\nআর অনিষ্ট হতে সমস্ত নারীদের, যারা গিরায় ফুঁক দেয়,\nআর অনিষ্ট হতে হিংসুকের, যখন সে হিংসা করে।’'
    }
  },
  nas: {
    id: 'surah_nas',
    arabic: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ\nمَلِكِ النَّاسِ\nإِلَـٰهِ النَّاسِ\nمِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ\nالَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ\nمِنَ الْجِنَّةِ وَالنَّاسِ',
    trn: {
      en: 'Qul a\'udhu bi rabbin-nas.\nMalikin-nas.\nIlahin-nas.\nMin sharril-waswasil-khannas.\nAlladhi yuwaswisu fi sudurin-nas.\nMinal-jinnati wan-nas.',
      bn: 'কুল আউযু বিরব্বিন-নাস।\nমালিকিন-নাস।\nইলাহিন-নাস।\nমিন শাররিল-ওয়াসওয়াসিল-খান্নাস।\nআল্লাযী ইউওয়াসওয়িসু ফী সুদূরিন-নাস।\nমিনাল-জিন্নাতি ওয়ান-নাস।'
    },
    meaning: {
      en: 'Say, \'I seek refuge in the Lord of mankind,\nThe Sovereign of mankind,\nThe God of mankind,\nFrom the evil of the retreating whisperer,\nWho whispers [evil] into the breasts of mankind,\nFrom among the jinn and mankind.\'',
      bn: 'বলুন, ‘আমি আশ্ৰয় প্রার্থনা করছি মানুষের রবের,\nমানুষের অধিপতির,\nমানুষের ইলাহের কাছে\nআত্মগোপনকারী কুমন্ত্রণাদাতার অনিষ্ট হতে,\nযে কুমন্ত্রণা দেয় মানুষের অন্তরে,\nজিনের মধ্য থেকে এবং মানুষের মধ্য থেকে।’'
    }
  }
};
