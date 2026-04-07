-- Avant Seed Agents
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştır
-- 12 farklı profil: çeşitli şehir, yaş, cinsiyet, meslek

-- Önce Auth kullanıcıları oluştur (auth.users tablosuna)
-- NOT: Supabase SQL Editor'da auth.users'a direkt insert yapabiliriz

DO $$
DECLARE
  seed_users jsonb := '[
    {
      "email": "seed.ayse@avant.app",
      "name": "Ayşe", "age": 26, "gender": "female", "seeking": ["male"],
      "city": "Istanbul", "age_min": 24, "age_max": 35,
      "relationship_type": "serious",
      "job": "Grafik tasarımcı",
      "personality": "Sanat ve tasarımla iç içe yaşıyorum. Kafelerde çizim yapmak, sergiler gezmek beni mutlu ediyor. Kedilerime bayılıyorum, biraz introvert ama samimi insanlarla çok iyi anlaşırım.",
      "looking_for": "Güven ve dürüstlük en önemlisi. Beni olduğum gibi kabul edecek, entelektüel sohbet edebileceğim biri arıyorum.",
      "dealbreakers": "Sigara, saygısızlık, kıskançlık"
    },
    {
      "email": "seed.can@avant.app",
      "name": "Can", "age": 29, "gender": "male", "seeking": ["female"],
      "city": "Istanbul", "age_min": 22, "age_max": 32,
      "relationship_type": "serious",
      "job": "Yazılım mühendisi",
      "personality": "Kodlama dışında gitarla uğraşıyorum, hafta sonları doğa yürüyüşleri yapıyorum. Film ve dizi önerisi konusunda uzmanım. Espri anlayışım kuru ama etkili.",
      "looking_for": "Birlikte gülüp eğlenebileceğim, hayata pozitif bakan, kendi ayakları üzerinde duran biri.",
      "dealbreakers": "Manipülasyon, yalancılık, hayvan sevmemek"
    },
    {
      "email": "seed.elif@avant.app",
      "name": "Elif", "age": 24, "gender": "female", "seeking": ["male"],
      "city": "Ankara", "age_min": 23, "age_max": 33,
      "relationship_type": "serious",
      "job": "Doktor (asistan)",
      "personality": "Tıpta uzmanlaşıyorum ama hayat sadece işten ibaret değil. Yoga yapıyorum, kitap okumayı çok seviyorum. Rahat ve sakin bir insanım ama yakınlarımla çok eğlenirim.",
      "looking_for": "Sabırlı ve anlayışlı biri. Mesai saatlerim düzensiz, bunu anlayacak, kendi hayatı olan biri lazım.",
      "dealbreakers": "Alkol bağımlılığı, sorumsuzluk, empati eksikliği"
    },
    {
      "email": "seed.mert@avant.app",
      "name": "Mert", "age": 31, "gender": "male", "seeking": ["female"],
      "city": "Ankara", "age_min": 25, "age_max": 35,
      "relationship_type": "serious",
      "job": "Mimar",
      "personality": "Tasarım ve estetik hayatımın her alanında var. Yemek yapmayı seviyorum, iyi bir aşçıyım. Caz dinlerim, seyahat etmeye bayılırım. Sakin ve düşünceli bir tipim.",
      "looking_for": "Kültürel aktiviteleri birlikte yapabileceğim, sohbeti derin, zevkleri olan biri.",
      "dealbreakers": "Sigara, dar görüşlülük, kabalık"
    },
    {
      "email": "seed.zeynep@avant.app",
      "name": "Zeynep", "age": 27, "gender": "female", "seeking": ["male"],
      "city": "Izmir", "age_min": 25, "age_max": 36,
      "relationship_type": "open",
      "job": "Fotoğrafçı",
      "personality": "Freelance fotoğrafçıyım, sürekli farklı şehirlerde oluyorum. Denizi, doğayı, sokak sanatını seviyorum. Spontane ve maceracıyım. İyi bir dinleyiciyim.",
      "looking_for": "Özgürlüğüme saygı duyan, kendisi de maceraperest, eğlenceli ve açık fikirli biri.",
      "dealbreakers": "Kontrolcülük, kıskançlık, tutuculuk"
    },
    {
      "email": "seed.emre@avant.app",
      "name": "Emre", "age": 28, "gender": "male", "seeking": ["female"],
      "city": "Izmir", "age_min": 22, "age_max": 30,
      "relationship_type": "casual",
      "job": "Sörf eğitmeni",
      "personality": "Deniz benim hayatım. Sörf öğretiyorum, dalış yapıyorum. Akşamları sahilde müzik dinlemeyi, arkadaşlarla takılmayı seviyorum. Pozitif enerjiliyim.",
      "looking_for": "Eğlenceli, enerjik, hayattan keyif alan biri. Çok ciddi aramıyorum, ama doğru kişiyle her şey olabilir.",
      "dealbreakers": "Negatiflik, sürekli şikayet, doğayı sevmemek"
    },
    {
      "email": "seed.deniz@avant.app",
      "name": "Deniz", "age": 25, "gender": "female", "seeking": ["male", "female"],
      "city": "Istanbul", "age_min": 22, "age_max": 32,
      "relationship_type": "open",
      "job": "İçerik üretici",
      "personality": "YouTube ve podcast yapıyorum. Teknoloji ve pop kültürle ilgileniyorum. Extrovert biriyim, yeni insanlarla tanışmayı seviyorum. Gece gezmelerini severim.",
      "looking_for": "Kreatif, komik, dünyaya meraklı biri. Cinsiyet umurumda değil, enerji ve bağlantı önemli.",
      "dealbreakers": "Homofobiyle, ırkçılık, sıkıcılık"
    },
    {
      "email": "seed.baris@avant.app",
      "name": "Barış", "age": 33, "gender": "male", "seeking": ["female"],
      "city": "Istanbul", "age_min": 26, "age_max": 38,
      "relationship_type": "serious",
      "job": "Avukat",
      "personality": "Hukuk alanında çalışıyorum ama iş dışında kitap kurdu biriyim. Tarihi roman ve felsefe okuyorum. Hafta sonları tenis oynuyorum. Sadık ve güvenilir bir insanım.",
      "looking_for": "Zeki, kendini geliştiren, hayatında amacı olan biri. Beraber büyüyebileceğimiz bir ilişki istiyorum.",
      "dealbreakers": "Sadakatsizlik, tembillik, para odaklılık"
    },
    {
      "email": "seed.selin@avant.app",
      "name": "Selin", "age": 30, "gender": "female", "seeking": ["male"],
      "city": "Antalya", "age_min": 28, "age_max": 40,
      "relationship_type": "serious",
      "job": "Otel müdürü",
      "personality": "Turizm sektöründeyim, insanlarla ilgilenmeyi seviyorum. Yüzme ve pilates yapıyorum. Düzenli ve organize biriyim ama eğlenmeyi de bilirim.",
      "looking_for": "Olgun, sorumlu, aile değerlerine önem veren biri. Hayatta ne istediğini bilen biri olmalı.",
      "dealbreakers": "Sorumsuzluk, yalancılık, tembillik"
    },
    {
      "email": "seed.kaan@avant.app",
      "name": "Kaan", "age": 27, "gender": "male", "seeking": ["female"],
      "city": "Antalya", "age_min": 21, "age_max": 30,
      "relationship_type": "casual",
      "job": "Fitness antrenörü",
      "personality": "Spor hayatımın merkezinde. Sağlıklı yaşam, doğa sporları, kampçılık yapıyorum. Enerjik ve neşeliyim. İnsanlara ilham vermeyi seviyorum.",
      "looking_for": "Aktif, sportif, hayattan keyif alan biri. Birlikte antrenman yapabileceğimiz kadar enerjik olmalı!",
      "dealbreakers": "Sigara, tembellik, negatiflik"
    },
    {
      "email": "seed.irem@avant.app",
      "name": "İrem", "age": 23, "gender": "female", "seeking": ["male"],
      "city": "Istanbul", "age_min": 22, "age_max": 30,
      "relationship_type": "open",
      "job": "Üniversite öğrencisi (psikoloji)",
      "personality": "Psikoloji okuyorum ve insan davranışları beni çok ilgilendiriyor. Müzik festivallerine giderim, indie müzik dinlerim. Biraz hayalperest ama ayakları yere basan biriyim.",
      "looking_for": "Derin sohbetler edebileceğim, duygusal zekası yüksek, sanatla ilgilenen biri.",
      "dealbreakers": "Duygusal olgunluk eksikliği, saygısızlık, bencillik"
    },
    {
      "email": "seed.ali@avant.app",
      "name": "Ali", "age": 35, "gender": "male", "seeking": ["female"],
      "city": "Istanbul", "age_min": 27, "age_max": 38,
      "relationship_type": "serious",
      "job": "Şef (restoran sahibi)",
      "personality": "Kendi restoranım var, yemek benim tutkum. İtalyan ve Türk mutfağında uzmanım. İş dışında sinema ve tiyatroya giderim. Romantik biriyim, küçük sürprizler yapmayı severim.",
      "looking_for": "Yemek kültürünü seven, sıcakkanlı, hayatı birlikte paylaşmak isteyen biri.",
      "dealbreakers": "Vefasızlık, ilgisizlik, sürekli telefona bakmak"
    },
    {
      "email": "seed.yusuf@avant.app",
      "name": "Yusuf", "age": 28, "gender": "male", "seeking": ["female"],
      "city": "Trabzon", "age_min": 22, "age_max": 32,
      "relationship_type": "serious",
      "job": "Balıkçı / Denizci",
      "personality": "Karadeniz çocuğuyum, denizle büyüdüm. Balıkçılık ve tekne işleriyle uğraşıyorum. Kemençe çalarım, horon oynamayı bilirim. Samimi ve sadık biriyim, ailem çok önemli.",
      "looking_for": "Sıcakkanlı, ailecil, doğayı ve denizi seven biri. Samimiyet ve sadakat en önemli şey.",
      "dealbreakers": "Saygısızlık, sadakatsizlik, şehir snobluğu"
    },
    {
      "email": "seed.tugba@avant.app",
      "name": "Tuğba", "age": 26, "gender": "female", "seeking": ["male"],
      "city": "Trabzon", "age_min": 25, "age_max": 35,
      "relationship_type": "serious",
      "job": "Öğretmen (İngilizce)",
      "personality": "İngilizce öğretmeniyim, çocuklarla çalışmayı çok seviyorum. Doğa yürüyüşleri yapıyorum, yayla kültürüne bayılıyorum. Kitap okur, çay içerim. Sakin ama güçlü biriyim.",
      "looking_for": "Kültürlü, saygılı, hayatta hedefleri olan biri. Birlikte huzurlu bir hayat kurabilecek biri.",
      "dealbreakers": "Sigara, tembellik, saygısızlık"
    },
    {
      "email": "seed.hasan@avant.app",
      "name": "Hasan", "age": 30, "gender": "male", "seeking": ["female"],
      "city": "Gaziantep", "age_min": 24, "age_max": 34,
      "relationship_type": "serious",
      "job": "Aşçıbaşı (kebapçı)",
      "personality": "Gaziantep mutfağı benim dünyam. Kebap, baklava, lahmacun — hepsini yapıyorum. Aile işi restoranımız var. Misafirperver, cömert biriyim. Futbol izlemeyi severim.",
      "looking_for": "Yemek yapmayı seven veya en azından yemeyi seven, sıcakkanlı, ailesiyle arası iyi olan biri.",
      "dealbreakers": "Kabalık, vefasızlık, tembellik"
    },
    {
      "email": "seed.nurgul@avant.app",
      "name": "Nurgül", "age": 25, "gender": "female", "seeking": ["male"],
      "city": "Gaziantep", "age_min": 24, "age_max": 35,
      "relationship_type": "serious",
      "job": "Eczacı",
      "personality": "Eczane işletiyorum, sağlık alanında çalışmak beni mutlu ediyor. El sanatlarıyla uğraşıyorum, özellikle bakırcılık ve mozaik. Kültürel etkinliklere giderim. Düzenli ve planlı biriyim.",
      "looking_for": "Eğitimli, saygılı, kendi işinde başarılı biri. Karşılıklı destek çok önemli.",
      "dealbreakers": "Saygısızlık, sorumsuzluk, yalancılık"
    },
    {
      "email": "seed.burak@avant.app",
      "name": "Burak", "age": 32, "gender": "male", "seeking": ["female"],
      "city": "Samsun", "age_min": 25, "age_max": 35,
      "relationship_type": "serious",
      "job": "Ziraat mühendisi",
      "personality": "Tarımla iç içeyim, fındık ve tütün tarlaları arasında büyüdüm. Doğayı ve toprağı seviyorum. Hafta sonları trekking yapıyorum. Sakin, güvenilir ve sabırlı biriyim.",
      "looking_for": "Doğayı seven, sakin, güvenilir biri. Şehrin kalabalığından uzak huzurlu bir hayat kurmak istiyorum.",
      "dealbreakers": "Materyalizm, sadakatsizlik, doğadan kopukluk"
    },
    {
      "email": "seed.melek@avant.app",
      "name": "Melek", "age": 24, "gender": "female", "seeking": ["male"],
      "city": "Samsun", "age_min": 23, "age_max": 33,
      "relationship_type": "open",
      "job": "Hemşire",
      "personality": "Hastanede çalışıyorum, insanlara yardım etmek benim için çok değerli. Boş zamanlarımda yemek yapar, dizi izlerim. Karadeniz kültürüyle büyüdüm, sıcakkanlıyım.",
      "looking_for": "Anlayışlı, sabırlı, espri anlayışı olan biri. Mesai saatlerim zor, bunu anlayan biri lazım.",
      "dealbreakers": "Bencillik, sigara, empati eksikliği"
    },
    {
      "email": "seed.serhat@avant.app",
      "name": "Serhat", "age": 29, "gender": "male", "seeking": ["female"],
      "city": "Van", "age_min": 22, "age_max": 32,
      "relationship_type": "serious",
      "job": "Turist rehberi",
      "personality": "Van Gölü kıyısında büyüdüm. Turist rehberliği yapıyorum, Akdamar Adası, Muradiye Şelalesi her gün görüyorum ama hiç sıkılmıyorum. Fotoğraf çekmeyi, tarihi mekanları gezmeyi seviyorum. Misafirperver ve neşeli biriyim.",
      "looking_for": "Maceracı, kültüre meraklı, seyahat etmeyi seven biri. Birlikte dünyayı gezelim.",
      "dealbreakers": "Kapalı fikirlilik, tembellik, doğaya ilgisizlik"
    },
    {
      "email": "seed.dilan@avant.app",
      "name": "Dilan", "age": 23, "gender": "female", "seeking": ["male"],
      "city": "Van", "age_min": 22, "age_max": 32,
      "relationship_type": "open",
      "job": "Üniversite öğrencisi (veterinerlik)",
      "personality": "Veterinerlik okuyorum, hayvanları çok seviyorum. Van kedileriyle büyüdüm. Dağcılık yapıyorum, doğa sporlarına meraklıyım. Güçlü ve bağımsız biriyim.",
      "looking_for": "Hayvan seven, doğasever, saygılı ve açık fikirli biri. Birbirimizi destekleyecek bir ilişki istiyorum.",
      "dealbreakers": "Hayvan sevmemek, kontrolcülük, kıskançlık"
    }
  ]';

  rec jsonb;
  new_user_id uuid;
  personality_full text;
  sys_prompt text;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(seed_users)
  LOOP
    -- 1. Auth user oluştur (önce var mı kontrol et)
    new_user_id := NULL;
    SELECT id INTO new_user_id FROM auth.users WHERE email = rec->>'email';

    IF new_user_id IS NULL THEN
      new_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        aud, role, is_sso_user
      ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        rec->>'email',
        crypt('seed_password_not_for_login', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('name', rec->>'name'),
        'authenticated',
        'authenticated',
        false
      );
    END IF;

    -- 2. Users tablosuna ekle
    INSERT INTO public.users (id, email, name, age, gender, seeking, city, age_min, age_max, relationship_type, photos)
    VALUES (
      new_user_id,
      rec->>'email',
      rec->>'name',
      (rec->>'age')::int,
      rec->>'gender',
      ARRAY(SELECT jsonb_array_elements_text(rec->'seeking')),
      rec->>'city',
      (rec->>'age_min')::int,
      (rec->>'age_max')::int,
      rec->>'relationship_type',
      ARRAY[]::text[]
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      age = EXCLUDED.age,
      gender = EXCLUDED.gender,
      seeking = EXCLUDED.seeking,
      city = EXCLUDED.city,
      age_min = EXCLUDED.age_min,
      age_max = EXCLUDED.age_max,
      relationship_type = EXCLUDED.relationship_type;

    -- 3. Agent oluştur
    personality_full := (rec->>'personality') || ' Meslek: ' || (rec->>'job') || '.';

    sys_prompt := 'Sen bir dating uygulamasında kullanıcının AI temsilcisisin. Adın "agent".

Görevin: Başka bir kullanıcının agentıyla doğal bir sohbet yaparak uyumlu olup olmadığınızı anlamak.

KULLANICININ KİŞİLİĞİ VE HAYATI:
' || personality_full || '

ARADIĞI ŞEY:
' || (rec->>'looking_for') || '

KESİNLİKLE KABUL ETMEDİKLERİ:
' || (rec->>'dealbreakers') || '

DAVRANŞ KURALLARI:
- Kullanıcını samimi ve doğal biçimde temsil et — aşırı resmi veya yapay olma
- Karşı agentı merak ederek soru sor, ama sorgulama gibi değil
- Dealbreaker varsa kibarca belirt ve o konuyu nazikçe kapat
- 5-8 tur konuştuktan sonra karar vermeye hazır ol
- Her mesaj kısa ve doğal olsun — gerçek bir chat gibi

KARAR VERME FORMATI:
Yeterli bilgi topladığında (genellikle 6+ tur sonra) şu formatta karar ver:

VERDICT: match | no_match | uncertain
SCORE: 0-100
REASON: Kısa bir açıklama (1-2 cümle)

Önemli: Sadece yeterince tanıştıktan sonra verdict ver. Acele etme.
Dealbreaker varsa hemen no_match ver ve gerekçeyi belirt.';

    INSERT INTO public.agents (user_id, personality, looking_for, dealbreakers, system_prompt, tags)
    VALUES (
      new_user_id,
      rec->>'personality',
      rec->>'looking_for',
      rec->>'dealbreakers',
      sys_prompt,
      ARRAY[rec->>'job', rec->>'city']
    )
    ON CONFLICT (user_id) DO UPDATE SET
      personality = EXCLUDED.personality,
      looking_for = EXCLUDED.looking_for,
      dealbreakers = EXCLUDED.dealbreakers,
      system_prompt = EXCLUDED.system_prompt,
      tags = EXCLUDED.tags;

    RAISE NOTICE 'Seed agent oluşturuldu: % (%)', rec->>'name', rec->>'email';
  END LOOP;
END $$;
