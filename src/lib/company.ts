export const foundedYear = 2007;
export const satisfiedClients = 12000; // approximate cumulative satisfied clients
export const flagshipProjects = 480; // notable bespoke builds, visualization & installation projects

export function yearsOfExcellence(reference: Date = new Date()): number {
  return reference.getFullYear() - foundedYear;
}

export function companyNarrative(locale: 'ua' | 'en' = 'ua') {
  const years = yearsOfExcellence();
  if (locale === 'ua') {
    return `З ${foundedYear} року ми перетворюємо ідеї у досконалі тюнінг-рішення: ${years}+ років досвіду, понад ${satisfiedClients.toLocaleString('uk-UA')} задоволених клієнтів та ${flagshipProjects}+ індивідуальних преміум проектів.`;
  }
  return `Since ${foundedYear} we have been shaping ideas into refined performance solutions: ${years}+ years of expertise, over ${satisfiedClients.toLocaleString('en-US')} satisfied clients and ${flagshipProjects}+ bespoke premium projects.`;
}
