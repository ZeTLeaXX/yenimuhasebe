
const fs = require('fs');
const content = `KULLANICI SÖZLEŞMESİ VE SORUMLULUK REDDİ

BU YAZILIMI YÜKLEMEDEN ÖNCE LÜTFEN AŞAĞIDAKİ ŞARTLARI DİKKATLİCE OKUYUNUZ.

1. BETA SÜRÜM UYARISI
Bu yazılım ("MuhasebeApp") şu anda geliştirme aşamasındadır (BETA). Yazılım, hatalar, eksiklikler veya diğer sorunlar içerebilir. Yazılım "OLDUĞU GİBİ" sunulmaktadır. Geliştirici, yazılımın kusursuz, hatasız veya kesintisiz çalışacağını garanti etmez.

2. VERİ KAYBI VE SORUMLULUK REDDİ
Geliştirici, bu yazılımın kullanımından veya kullanılamamasından kaynaklanan herhangi bir doğrudan, dolaylı, arızi veya nihai zarardan (veri kaybı, kar kaybı, iş kesintisi veya bilgisayar arızası dahil ancak bunlarla sınırlı olmamak üzere) sorumlu tutulamaz.
Kullanıcılar, verilerini düzenli olarak yedeklemekle yükümlüdür. Oluşabilecek herhangi bir veri kaybından geliştirici sorumlu değildir.

3. KABUL
Bu yazılımı yükleyerek, kopyalayarak veya kullanarak, bu sözleşmenin tüm şartlarını okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz. Eğer bu şartları kabul etmiyorsanız, kurulumu iptal ediniz ve yazılımı kullanmayınız.
`;

// Write with BOM
fs.writeFileSync('license.txt', '\ufeff' + content, { encoding: 'utf8' });
console.log('License file created with BOM.');
