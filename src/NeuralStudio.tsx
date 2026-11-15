import {useId, useState} from 'react';
import {CodeEditor} from './components';
import {LessonObjective, Metrics, PracticeQuestion, RangeControl} from './StudioControls';
import {TrainingLab} from './NeuralTraining';
import {deepLessons, type DeepLesson, type DeepLessonId} from './deepLessons';
import {activate, activations, bce, descent, derivative, forward, gradient, numericalGradient, trainStep, weighted, type Activation, type Row} from './lib/neural';
import './neural-studio.css';

import {Curve, display} from './NeuralPlot';

function Slider({label, value, onChange}: {label: string; value: number; onChange: (value:number)=>void}) {
  return <RangeControl label={label} min={-4} max={4} step={.25} value={value} onChange={onChange}/>;
}
function Neuron() {
  const [values,setValues] = useState([2,1,3,-1,.5]);
  const [kind,setKind] = useState<Activation>('Linear');
  const sum = weighted(values.slice(0,2),values.slice(2,4),values[4]);
  return <><h2>Build a neuron</h2><div className="neural-controls">{['Input 1','Input 2','Weight 1','Weight 2','Bias'].map((label,i)=>
    <Slider key={label} label={label} value={values[i]} onChange={value=>setValues(items=>items.map((item,j)=>j===i?value:item))}/>)}</div>
    <label>Activation <select value={kind} onChange={event=>setKind(event.target.value as Activation)}>{activations.map(key=><option key={key}>{key}</option>)}</select></label>
    <p><code>{values[0]} × {values[2]} + {values[1]} × {values[3]} + ({values[4]}) = {display(sum)}</code></p>
    <Metrics values={[[ 'Weighted sum', display(sum)], ['Activated output', display(activate(kind,sum))]]}/>
  </>;
}
function Activations() {
  const [kind,setKind] = useState<Activation>('Sigmoid');
  const [input,setInput] = useState(0);
  return <><h2>Compare activation curves</h2>
    <label>Function <select value={kind} onChange={event=>setKind(event.target.value as Activation)}>{activations.map(item=><option key={item}>{item}</option>)}</select></label>
    <RangeControl label="Preactivation z" min={-8} max={8} step={.25} value={input} onChange={setInput}/>
    <Curve values={Array.from({length:65},(_,i)=>activate(kind,i/4-8))} label={kind+' activation curve'} xLabel="Input z from −8 to 8" cursor={(input+8)*4}/>
    <Metrics values={activations.map(item=>[item, display(activate(item,input))])}/>
    <p>Local slope for {kind}: {kind==='ReLU'&&input===0 ? 'Undefined at zero' : display(derivative(kind,input))}. A small slope means changes in input have little local effect.</p>
  </>;
}
function Network({backprop}: {backprop:boolean}) {
  const [params,setParams] = useState([1,-1,.25,1,-.5,1,.25,1,0]);
  const [x,setX] = useState<Row['x']>([1,.5]);
  const [target,setTarget] = useState<0|1>(1);
  const [index,setIndex] = useState(0);
  const labels = ['Hidden 1 input 1 weight','Hidden 1 input 2 weight','Hidden 1 bias','Hidden 1 output weight',
    'Hidden 2 input 1 weight','Hidden 2 input 2 weight','Hidden 2 bias','Hidden 2 output weight','Output bias'];
  const current = forward(params,x);
  const row = {id:0,x,y:target};
  const analytic = backprop ? gradient(params,row)[index] : 0;
  const numerical = backprop ? numericalGradient(params,row,index) : 0;
  return <><h2>{backprop?'Trace the gradient':'Follow a forward pass'}</h2>
    <div className="neural-controls"><Slider label="Feature x₁" value={x[0]} onChange={value=>setX([value,x[1]])}/>
      <Slider label="Feature x₂" value={x[1]} onChange={value=>setX([x[0],value])}/></div>
    <label>Parameter <select value={index} onChange={event=>setIndex(Number(event.target.value))}>{labels.map((label,i)=><option key={label} value={i}>{label}</option>)}</select></label>
    <Slider label="Parameter value" value={Math.max(-4,Math.min(4,params[index]))} onChange={value=>setParams(items=>items.map((item,i)=>i===index?value:item))}/>
    <svg className="neural-plot neural-network" viewBox="0 0 360 148" role="img" aria-label="Two inputs, two tanh neurons and one sigmoid output">
      <path d="M44 45L174 45M44 45L174 105M44 105L174 45M44 105L174 105M174 45L308 75M174 105L308 75" fill="none" stroke="currentColor"/>
      {[[44,45],[44,105],[174,45],[174,105],[308,75]].map(([cx,cy],i)=><g key={i}><circle cx={cx} cy={cy} r="28"/>
        <text x={cx} y={cy+4} textAnchor="middle">{display([...x,...current.hidden,current.probability][i])}</text></g>)}
      <text x="44" y="15" textAnchor="middle">Inputs</text><text x="174" y="15" textAnchor="middle">Hidden</text><text x="308" y="15" textAnchor="middle">Prediction</text>
    </svg>
    <Metrics values={[[ 'Hidden 1 tanh', display(current.hidden[0])], ['Hidden 2 tanh', display(current.hidden[1])],
      ['Output logit',display(current.logit)],['Class 1 probability',display(current.probability)]]}/>
    {backprop && <><label>True class <select value={target} onChange={event=>setTarget(Number(event.target.value) as 0|1)}><option>0</option><option>1</option></select></label>
      <ol><li>Compare the prediction with the label using cross-entropy.</li><li>Multiply the gradient by each local slope going backward.</li><li>Subtract 0.2 times each gradient from its parameter.</li></ol>
      <Metrics values={[[ 'Loss',display(bce(current.logit,target))], ['Analytic gradient',display(analytic)], ['Finite difference',display(numerical)],
        ['Absolute difference',Math.abs(analytic-numerical).toExponential(2)]]}/>
      <button className="button primary" onClick={()=>setParams(trainStep(params,[row],.2))}>Apply gradient step</button>
    </>}
  </>;
}
function Descent() {
  const [rate,setRate] = useState(.1);
  const [kind,setKind] = useState<'MSE'|'BCE'>('MSE');
  const id = useId();
  const {history,unstable} = descent(0,rate,kind);
  return <><h2>Take downhill steps</h2>
    <label htmlFor={id}>Loss function</label> <select id={id} value={kind} onChange={event=>setKind(event.target.value as 'MSE'|'BCE')}><option>MSE</option><option>BCE</option></select>
    <RangeControl label="Learning rate" min={.01} max={2.5} step={.01} value={rate} onChange={setRate}/>
    <p>{kind==='MSE'?'The weight predicts a number, with target 2.':'The weight is a logit, with target class 1.'} Each plotted point is calculated after a parameter update, starting at step 0.</p>
    <Curve values={history.map(item=>item.loss)} label="Calculated loss by gradient step" xLabel="Gradient step"/>
    <Metrics values={[[ 'Initial loss',display(history[0]?.loss ?? null)],['Last finite loss',display(history.at(-1)?.loss ?? null)],
      ['First gradient',display(history[0]?.gradient ?? null)],['Final weight',display(history.at(-1)?.weight ?? null)]]}/>
    {unstable && <p role="alert">Weights exceeded the stability limit. Try a smaller learning rate.</p>}
  </>;
}
export function NeuralStudio({lesson, progress, onOpen, onQuiz, onCode}: {
  lesson: DeepLesson; progress?: {quiz:boolean;code:boolean}; onOpen:(id:DeepLessonId)=>void; onQuiz:()=>void; onCode:()=>void;
}) {
  const experiment = {'dl-neurons': <Neuron/>, 'dl-activations': <Activations/>, 'dl-forward': <Network backprop={false}/>,
    'dl-descent': <Descent/>, 'dl-backprop': <Network backprop/>, 'dl-training': <TrainingLab/>}[lesson.id];
  return <div className="analysis-studio neural-studio">
    <div className="page-heading v5-heading"><h1>Deep Learning Foundations Studio</h1><p>{lesson.title}</p></div>
    <nav className="lab-picker analysis-lessons" aria-label="Deep Learning lessons">{deepLessons.map(item=><button key={item.id}
      aria-current={item.id===lesson.id?'page':undefined} aria-pressed={item.id===lesson.id} onClick={()=>onOpen(item.id)}>{item.title}</button>)}</nav>
    <div className="analysis-grid">
      <div className="analysis-column"><article className="experiment analysis-panel">
        <h2>{lesson.title}</h2><LessonObjective>{lesson.task}</LessonObjective><p>{lesson.concept}</p><p>{lesson.analogy}</p>
        <h3>Worked calculation</h3><p>{lesson.worked}</p>
        <details className="lab-hint"><summary>Common mistake</summary><p>{lesson.mistake}</p></details>
        <details className="lab-hint"><summary>Hinglish memory hint</summary><p>{lesson.hint}</p></details>
      </article><section className="experiment analysis-panel">{experiment}</section></div>
      <div className="analysis-column"><CodeEditor draftId={lesson.id} lesson={{...lesson,challenge:lesson.task}} onPass={onCode}/>
        <PracticeQuestion {...lesson.quiz} onPass={onQuiz}/>
        <section className="experiment analysis-panel"><h2>Takeaway</h2><p>{lesson.quiz.explanation}</p>
          <p>{progress?.code&&progress.quiz?'Lesson complete.':'Pass the Python challenge and knowledge check to complete this lesson.'}</p></section>
      </div>
    </div>
  </div>;
}
