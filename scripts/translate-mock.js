const fs = require('fs');
const data = JSON.parse(fs.readFileSync('brabus-products.json'));

data.forEach(p => {
  if (p.sku === 'F13-257-BP') {
    p.titleEn = 'BRABUS Monoblock F Black Platinum Forged Wheels - Mercedes-Benz CLS 53 AMG';
    p.titleUk = 'Ковані диски BRABUS Monoblock F Black Platinum для Mercedes-Benz CLS 53 AMG';
    p.descriptionEn = '<p>The <strong>BRABUS Monoblock F "Black Platinum"</strong> hi-tech forged wheels set new styling standards with their sporty-elegant cross-spoke design. These outstanding wheels highlight three-dimensional geometry, offering a robust yet lightweight alternative to standard cast wheels. Manufactured with OEM standard precision, each wheel features the exclusive BRABUS signet and "Forged" seal.</p>';
    p.descriptionUk = '<p>Високотехнологічні ковані диски <strong>BRABUS Monoblock F "Black Platinum"</strong> встановлюють нові стандарти стилю завдяки своєму спортивно-елегантному дизайну з перехресними спицями. Вони пропонують надміцну, але легку альтернативу звичайним литим дискам. Виготовлені з піковою точністю за стандартами OEM, кожен диск має ексклюзивний логотип BRABUS та фірмову печатку "Forged".</p>';
  } else if (p.sku === 'F14-257-PE') {
    p.titleEn = 'BRABUS Monoblock F Platinum Edition Forged Wheels - Mercedes-Benz CLS 53 AMG';
    p.titleUk = 'Ковані диски BRABUS Monoblock F Platinum Edition для Mercedes-Benz CLS 53 AMG';
    p.descriptionEn = '<p>The <strong>BRABUS Monoblock F "Platinum Edition"</strong> hi-tech forged wheels feature a stunning brushed finish. Designed with an offset cross-spoke geometry that extends to the outer rim flange, they deliver an impressive optical depth and dramatically reduce unsprung weight.</p>';
    p.descriptionUk = '<p>Високотехнологічні ковані диски <strong>BRABUS Monoblock F "Platinum Edition"</strong> відрізняються вражаючим матовим (brushed) покриттям. Завдяки геометрії перехресних спиць, що тягнуться до самого краю обода, вони забезпечують неймовірну оптичну глибину та значно знижують непідресорені маси.</p>';
  } else {
    p.titleEn = p.title.replace('Tuning based on ', 'BRABUS Tuning Program - ');
    p.titleUk = 'Програма тюнінгу BRABUS - ' + p.title.replace('Tuning based on ', '');
    p.descriptionEn = '<p>Discover the exclusive <strong>BRABUS Premium Tuning Program</strong> for your Mercedes-Benz. Transform your vehicle with custom aerodynamics, forged wheels, performance upgrades, and bespoke interior refinements tailored to the highest engineering standards.</p>';
    p.descriptionUk = '<p>Відкрийте для себе ексклюзивну <strong>програму преміального тюнінгу BRABUS</strong>. Трансформуйте свій автомобіль за допомогою карбонової аеродинаміки, кованих дисків, підвищення потужності та індивідуального вдосконалення інтер\'єру, створеного за найвищими стандартами Німеччини.</p>';
  }
});

fs.writeFileSync('brabus-seo-catalog.json', JSON.stringify(data, null, 2));
console.log('Successfully translated manually!');
