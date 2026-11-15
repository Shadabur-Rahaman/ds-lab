import {useState} from 'react';
import {ArrowUpRight, ChartNoAxesCombined, FlaskConical} from 'lucide-react';
import {BarChart, Metrics, Plot, PracticeQuestion, RangeControl} from './StudioControls';

const topics = [
  {id: 'center', title: 'Mean, median & outliers', short: 'Averages & outliers',
    description: 'Change a large café order and see how it affects two measures of a typical purchase.',
    hint: 'Mean sab values ko count karta hai. Median sorted list ke beech mein milta hai.'},
  {id: 'probability', title: 'Probability', short: 'Probability',
    description: 'Model whether visitors sign up when each visitor has the same independent chance of converting.',
    concept: 'Probability runs from 0 (impossible) to 1 (certain). Multiply the probability by the number of trials to find the expected count.',
    hint: 'Har trial ka chance same hai. Chhote batches mein results kaafi vary kar sakte hain.',
    question: {prompt: 'If 25% of visitors are expected to sign up, how many signups do you expect in 200 visits?',
      options: ['Exactly 200', 'About 50 on average', 'About 25 on average'], answer: 1,
      explanation: 'Expected count is 200 × 0.25 = 50. A particular batch can differ.'},
    code: {challenge: 'Calculate the expected signups for 200 visits at a conversion probability of 0.25. Store the result in expected.',
      starter: 'visits = 200\nprobability = 0.25\nexpected = 0  # Replace this with a calculation\nprint(expected)',
      tests: 'assert expected == 50, "Multiply visits by the probability."',
      hint: 'Multiply visits by probability.'}},
  {id: 'normal', title: 'Normal distribution', short: 'Normal curve',
    description: 'Use a normal model for plant heights. The mean shifts the curve, and the standard deviation controls its spread.',
    concept: 'The normal curve is symmetric. About 68% of values lie within one standard deviation of its mean. Probability is the area under the curve over an interval.',
    hint: 'Mean center batata hai. Standard deviation badhe toh curve aur wide hoti hai.',
    question: {prompt: 'What happens when the standard deviation grows while the mean stays fixed?',
      options: ['The center shifts right', 'The curve widens', 'The curve narrows'], answer: 1,
      explanation: 'A higher standard deviation spreads the same total probability over a wider interval.'},
    code: {challenge: 'Use NormalDist to find the probability that a plant is at most 50 cm tall. Store it in probability.',
      starter: 'from statistics import NormalDist\n\nheights = NormalDist(50, 8)\nprobability = 0  # Use the cumulative distribution\nprint(probability)',
      tests: 'assert abs(probability - 0.5) < 1e-9, "Half of the distribution lies below its center."',
      hint: 'Try heights.cdf(50).'}},
  {id: 'correlation', title: 'Correlation', short: 'Correlation',
    description: 'Compare two ratings across the same cafés. The Pearson coefficient r measures the direction and strength of their linear relationship.',
    concept: 'Pearson r runs from −1 to +1. The sign gives the direction and the magnitude gives the strength of a linear relationship. A scatter plot can reveal patterns that r misses.',
    hint: 'Dono cheezein saath move karein toh bhi cause prove nahi hota.',
    question: {prompt: 'If two ratings have r = 0, what can you conclude?',
      options: ['They have no linear association', 'One rating causes the other', 'The ratings cannot have any relationship'], answer: 0,
      explanation: 'A zero coefficient can still occur when there is a nonlinear relationship.'},
    code: {challenge: 'Compute the Pearson correlation between the two rating lists. Store it in r.',
      starter: 'from statistics import correlation\n\nfood = [1, 2, 3, 4, 5]\nservice = [5, 4, 3, 2, 1]\nr = 0  # Compute the correlation\nprint(r)',
      tests: 'assert abs(r + 1) < 1e-9, "The ratings have a perfect negative linear relationship."',
      hint: 'Try correlation(food, service).'}},
  {id: 'sampling', title: 'Sampling', short: 'Sampling',
    description: 'Estimate average delivery time from repeated random samples. Each draw is independent and allows repeats.',
    concept: 'A sample mean estimates the population mean. The standard error is the standard deviation of sample means across repeated samples of the same size.',
    hint: 'Bada random sample usually zyada stable average deta hai.',
    question: {prompt: 'What usually happens to the variability of sample means when sample size increases?',
      options: ['It decreases', 'It increases', 'It stays fixed'], answer: 0,
      explanation: 'For independent draws, the standard error is the population SD divided by the square root of sample size.'},
    code: {challenge: 'Calculate the theoretical standard error for samples of 16 independent delivery times. Store it in standard_error.',
      starter: 'from math import sqrt\n\npopulation_sd = 12\nsample_size = 16\nstandard_error = 0  # Scale the population SD\nprint(standard_error)',
      tests: 'assert abs(standard_error - 3) < 1e-9, "Divide the population SD by the square root of the sample size."',
      hint: 'Use population_sd / sqrt(sample_size).'}},
] as const;

export const statisticsTopics = topics;
export type StatisticsTopic = typeof topics[number];
const percent = (value: number) => (100 * value).toFixed(1) + '%';
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function Center() {
  const [largest, setLargest] = useState(40);
  const orders = [20, 25, 30, 35, largest];
  return <>
    <div className="lab-metrics stat-pair">
      <div><small>Mean order</small><strong data-testid="mean">₹{average(orders)}</strong></div>
      <div><small>Median order</small><strong>₹30</strong></div>
    </div>
    <BarChart counts={orders} labels={orders.map(value => '₹' + value)} scale={200}
      description={orders.map(value => '₹' + value).join(', ')} caption="Five café orders, in rupees"/>
    <label className="slider-label" htmlFor="outlier">Largest order <strong>₹{largest}</strong></label>
    <input id="outlier" type="range" min="40" max="200" step="5" value={largest}
      aria-valuetext={'₹' + largest} onChange={event => setLargest(Number(event.target.value))}/>
    <p className="callout">The mean includes every rupee. The middle value stays at ₹30. A large catering order could be valid even if it makes the mean less typical.</p>
  </>;
}

function Probability() {
  const [chance, setChance] = useState(25);
  const [result, setResult] = useState<{visits: number; signups: number}>({visits: 0, signups: 0});
  const rate = result.visits ? percent(result.signups / result.visits) : '—';
  function simulate(visits: number) {
    let signups = 0;
    for (let index = 0; index < visits; index++) signups += Number(Math.random() < chance / 100);
    setResult(previous => ({visits: previous.visits + visits, signups: previous.signups + signups}));
  }

  return <>
    <RangeControl label="Signup probability" min={0} max={100} value={chance} display={chance + '%'}
      onChange={value => {setChance(value); setResult({visits: 0, signups: 0});}}/>
    <div className="lab-actions">
      <button className="button primary" onClick={() => simulate(10)}>Simulate 10 visits</button>
      <button className="button" onClick={() => simulate(200)}>Simulate 200 visits</button>
      <button className="button" onClick={() => setResult({visits: 0, signups: 0})}>Reset visits</button>
    </div>
    <Metrics values={[[ 'Visits', String(result.visits)], ['Signups', String(result.signups)], ['Observed rate', rate]]}/>
    <BarChart counts={[result.signups, result.visits - result.signups]} labels={['Signups', 'No signup']}
      scale={Math.max(1, result.visits)} description={result.signups + ' signups in ' + result.visits + ' visits'}
      caption="Counts from all simulated visits at the current probability"/>
  </>;
}

function Normal() {
  const [mean, setMean] = useState(50);
  const [sd, setSd] = useState(8);
  const [band, setBand] = useState(1);
  const x = (value: number) => 28 + value / 100 * 344;
  const y = (value: number) => 145 - 120 * (4 / sd) * Math.exp(-.5 * ((value - mean) / sd) ** 2);
  const curve = Array.from({length: 201}, (_, index) => x(index / 2) + ',' + y(index / 2)).join(' ');
  const low = mean - band * sd;
  const high = mean + band * sd;
  const area = Array.from({length: 101}, (_, index) => low + (high - low) * index / 100)
    .map(value => x(value) + ',' + y(value)).join(' ');

  return <>
    <RangeControl label="Mean height" min={36} max={64} value={mean} onChange={setMean} display={mean + ' cm'}/>
    <RangeControl label="Standard deviation" min={4} max={12} value={sd} onChange={setSd} display={sd + ' cm'}/>
    <RangeControl label="Standard deviations from the mean" min={1} max={3} value={band} onChange={setBand}/>
    <Plot description={'Normal curve centered at ' + mean + ' cm, shaded from ' + low + ' to ' + high + ' cm'}
      caption="Plant height (cm). Shaded area represents probability within the selected band.">
      <polygon className="lab-shade" points={x(low) + ',145 ' + area + ' ' + x(high) + ',145'}/>
      <polyline className="lab-curve" points={curve}/>
      <line className="lab-reference" x1={x(mean)} x2={x(mean)} y1={145} y2={y(mean)}/>
      {[0, 25, 50, 75, 100].map(label => <text key={label} x={x(label)} y="167" textAnchor="middle">{label}</text>)}
    </Plot>
    <Metrics values={[[ 'Height band', low + '–' + high + ' cm'], ['Probability within band', ['68.27%', '95.45%', '99.73%'][band - 1]]]}/>
  </>;
}

function Correlation() {
  const [trend, setTrend] = useState(65);
  const x = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  const noise = [2, -2, 1, -1, 0, -1, 1, -2, 2];
  const y = x.map((value, index) => trend / 100 * value + (1 - Math.abs(trend) / 100) * noise[index]);
  const r = x.reduce((sum, value, index) => sum + value * y[index], 0) /
    Math.sqrt(x.reduce((sum, value) => sum + value ** 2, 0) * y.reduce((sum, value) => sum + value ** 2, 0));
  return <>
    <RangeControl label="Simulated trend" min={-100} max={100} step={5} value={trend} onChange={setTrend}/>
    <Plot description={'Scatter plot of nine cafes with Pearson r of ' + r.toFixed(2)}
      caption="Food rating deviation increases left to right. Service rating deviation increases bottom to top. Each dot represents a simulated café.">
      <line className="lab-gridline" x1="200" x2="200" y1="25" y2="145"/>
      <line className="lab-gridline" x1="28" x2="372" y1="85" y2="85"/>
      {x.map((value, index) => <circle className="lab-bar" key={value} cx={200 + value * 39} cy={85 - y[index] * 14} r="6"/>)}
      <text x="44" y="167" textAnchor="middle">−4</text>
      <text x="200" y="167" textAnchor="middle">0</text>
      <text x="356" y="167" textAnchor="middle">4</text>
    </Plot>
    <Metrics values={[[ 'Pearson r', r.toFixed(2)]]}/>
  </>;
}

const deliveryTimes = [12, 18, 24, 30, 36, 42, 48];
const populationMean = average(deliveryTimes);
const populationSd = Math.sqrt(average(deliveryTimes.map(time => (time - populationMean) ** 2)));

function Sampling() {
  const [size, setSize] = useState(5);
  const [means, setMeans] = useState<number[]>([]);
  const bins = Array.from({length: 9}, () => 0);
  for (const mean of means) bins[Math.min(8, Math.floor((mean - 12) / 4))]++;
  function draw() {
    setMeans(Array.from({length: 100}, () =>
      average(Array.from({length: size}, () => deliveryTimes[Math.floor(Math.random() * deliveryTimes.length)]))));
  }

  return <>
    <RangeControl label="Deliveries per sample" min={1} max={50} value={size}
      onChange={value => {setSize(value); setMeans([]);}}/>
    <button className="button primary" onClick={draw}>Draw 100 samples</button>
    <Metrics values={[[ 'Population mean', populationMean + ' min'],
      ['Theoretical standard error', (populationSd / Math.sqrt(size)).toFixed(2) + ' min'],
      ['Mean of sample means', means.length ? average(means).toFixed(2) + ' min' : '—']]}/>
    <BarChart counts={bins} labels={bins.map((_, index) => String(12 + index * 4))} scale={100}
      description={means.length ? bins.map((count, index) => 'Bin starting at ' + (12 + index * 4) + ' minutes: ' + count).join('; ') : 'Draw samples to show the distribution'}
      caption="Histogram of sample means (minutes). Labels mark the start of each four-minute bin. The final bin includes 48."/>
    <p className="callout">The model gives equal weight to 12, 18, 24, 30, 36, 42 and 48 minutes. Try one delivery per sample, then 50, and compare the spread.</p>
  </>;
}

const experiments = {center: Center, probability: Probability, normal: Normal, correlation: Correlation, sampling: Sampling};

export function StatisticsPicker({topic, onSelect}: {topic: StatisticsTopic; onSelect: (topic: StatisticsTopic) => void}) {
  return <div className="lab-picker" role="group" aria-label="Statistics topics">
    {topics.map(item => <button key={item.id} aria-pressed={topic.id === item.id} onClick={() => onSelect(item)}>{item.short}</button>)}
  </div>;
}

export function StatisticsExperiment({topic}: {topic: StatisticsTopic}) {
  const Experiment = experiments[topic.id];
  return <section className="experiment lab-experiment" aria-labelledby="experiment-title">
    <div className="lab-intro"><span className="value-icon purple"><FlaskConical size={22}/></span>
      <div><h2 id="experiment-title">{topic.title}</h2><p>{topic.description}</p></div>
    </div>
    <Experiment/>
    <details className="lab-hint"><summary>Hinglish memory hint</summary><p>{topic.hint}</p></details>
  </section>;
}

export function StatisticsQuestion({topic}: {topic: Exclude<StatisticsTopic, {id: 'center'}>}) {
  return <PracticeQuestion {...topic.question}/>;
}

export function StatisticsFeature({onOpen, className = ''}: {onOpen: () => void; className?: string}) {
  return <button className={'statistics-feature ' + className} onClick={onOpen}>
    <span className="value-icon purple"><ChartNoAxesCombined size={25}/></span>
    <span><strong>Statistics Learning Studio</strong><small>Five interactive labs with quizzes and Python practice</small></span>
    <ArrowUpRight size={20}/>
  </button>;
}
