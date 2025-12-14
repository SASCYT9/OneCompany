
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/logos/kw-suspensions-seeklogo.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Simple regex to find all numbers in d attributes
const dRegex = /d="([^"]+)"/g;
let match;
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

while ((match = dRegex.exec(svgContent)) !== null) {
    const d = match[1];
    // Split by anything that is not a digit, minus sign, or dot
    const numbers = d.split(/[^0-9.-]+/).filter(n => n !== '' && n !== '-').map(Number);
    
    // This is a very rough approximation because it treats all numbers as coordinates
    // relative or absolute, and doesn't distinguish x/y. 
    // But for finding global min/max in a file with mostly absolute coords, it gives a hint.
    // A better way is to look for pairs, but SVG paths are complex.
    // Let's just look at the raw numbers to see the range.
    
    for (const num of numbers) {
        if (!isNaN(num)) {
             // We can't easily distinguish X and Y without a real parser, 
             // but we can see the global range of values.
        }
    }
}

// Let's try a slightly smarter regex for coordinate pairs if possible, 
// or just dump all numbers and see the extremes.
const allNumbers = [];
while ((match = dRegex.exec(svgContent)) !== null) {
    const d = match[1];
    const numbers = d.split(/[^0-9.-]+/).filter(n => n.trim() !== '').map(Number);
    allNumbers.push(...numbers);
}

const validNumbers = allNumbers.filter(n => !isNaN(n));
const min = Math.min(...validNumbers);
const max = Math.max(...validNumbers);

console.log(`Global Min: ${min}`);
console.log(`Global Max: ${max}`);

// Let's try to parse M commands specifically to get starting points
const mRegex = /[Mm]\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)/g;
let mMatch;
let startPoints = [];
while ((mMatch = mRegex.exec(svgContent)) !== null) {
    startPoints.push({x: parseFloat(mMatch[1]), y: parseFloat(mMatch[2])});
}

const minMX = Math.min(...startPoints.map(p => p.x));
const maxMX = Math.max(...startPoints.map(p => p.x));
const minMY = Math.min(...startPoints.map(p => p.y));
const maxMY = Math.max(...startPoints.map(p => p.y));

console.log('Start Points (M commands):');
console.log(`Min X: ${minMX}, Max X: ${maxMX}`);
console.log(`Min Y: ${minMY}, Max Y: ${maxMY}`);
