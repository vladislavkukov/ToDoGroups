import './dash.css';
import {auth, db} from "./firebase";
import { useEffect, useState, type FormEvent, type ChangeEvent, use } from 'react';
import { addDoc, collection, onSnapshot, query, where, orderBy, doc, deleteDoc, getDoc, setDoc, updateDoc, increment, arrayRemove, arrayUnion} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";




function Dash() {
    const [user, setUser] = useState(auth.currentUser);
    useEffect(() => {
    const unsub = onAuthStateChanged(auth, current => setUser(current));
    return unsub;
    }, []);
    if (user === undefined) return <p>Loading...</p>;
    return (
        <div className="">
            <GoalForm user = {user}/>
            <Feed user = {user}/>
        </div>
    )
}

type Freq = "Once" | "Daily" | "Weekly" | "Monthly";
type GoalMap = {
        [date:string]: Goals[];
    }

const today = toLocal(new Date());


function Feed({user} : {user:any}){

    const [Selection, changeSelection] = useState('0')

    const handleDelete = async (id: string) => {
        await deleteDoc(doc(db, "goal", id));
        setGoals(prev => prev.filter(goal => goal.id !== id));
        setDelGoal(null);
    }

    const handleComplete = async (id: string, end: Date, current: string, change: string) => {
        const date = new Date(current);
        const ogCol = doc(db, "goal", id);
        const goalD = await getDoc(ogCol);
        const newLength = goalD.data()!.toDo.length - 1;
        

        if (change === "c") {
            await updateDoc(ogCol, {
                toDo: arrayRemove(date),
                done: arrayUnion(date)
            });
        }

        else {
            await updateDoc(ogCol, {
                toDo: arrayRemove(date),
                failed: arrayUnion(date)
            });
        }
        
        if (newLength === 0) {
            const goal = await getDoc(ogCol);
            const newCol = doc(db, "compGoal", id);
            await setDoc(newCol, goal.data());
            await deleteDoc(ogCol);
        }
    }


    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        changeSelection(e.target.value);
    }

    const [delGoal, setDelGoal] = useState<string|null>(null);

    if (!user?.uid) return;
    const [goals, setGoals] = useState<Goals[]>([]);
    const [compGoals, setCompGoals] = useState<Goals[]>([]);
    useEffect(() => {
        const goalsCol = collection(db, "goal");
        const find = query(
            goalsCol, where ("userId", "==", user?.uid),
            orderBy("start", "asc")
        );
        const unsub = onSnapshot(find, snapshot => {
            const goalsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Goals),
                start: doc.data().start.toDate(),
                end: doc.data().end.toDate(),
                toDo: doc.data().toDo.map((date:any) => date.toDate()),
                done: doc.data().done.map((date:any) => date.toDate()),
                failed: doc.data().failed.map((date:any) => date.toDate())
            }));
            setGoals(goalsList);
        });
        return unsub;
    }, [user]);

    useEffect(() => {
        const goalsCol = collection(db, "compGoal");
        const find = query(
            goalsCol, where ("userId", "==", user?.uid),
            orderBy("start", "asc")
        );
        const unsub = onSnapshot(find, snapshot => {
            const compGoalsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Goals),
                start: doc.data().start.toDate(),
                end: doc.data().end.toDate(),
                frequency: doc.data().frequency,
                done: doc.data().done?.map((date:any) => date.toDate()),
                failed: doc.data().failed?.map((date:any) => date.toDate())
            }));
            setCompGoals(compGoalsList);
        });
        return unsub;
    }, [user]);
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let dates: Date[]
    let map: GoalMap = {} 
    for (const goal of goals) {
    dates = goal.toDo;
    dates.forEach(date => {
        const key = toLocal(date).toDateString();
        if (!map[key]) {map[key] = []}
        map[key].push(goal)
        })}


    return (
        <div>
        <div>
            <h2>Current Goals</h2>
            {goals.length === 0 ? (
                <h4>No Goals Yet</h4>
            ) : (
                <ul>
                {goals.map(goal => {
                    let message = ``
                    switch (goal.frequency){
                        case "Once":
                            message = `on ${goal.start.toDateString()}`;
                            break;
                        case "Daily":
                            message = `Every Day\n from ${goal.start.toDateString()} to ${goal.end.toDateString()}`;
                            break;
                        case "Weekly":
                            message = `Every Week on ${days[goal.start.getDay()]}\n from ${goal.start.toDateString()} to ${goal.end.toDateString()}`;
                            break;
                        case "Monthly":
                            message = `Every Month on Day ${goal.start.getDate()}\n from ${goal.start.toDateString()} to ${goal.end.toDateString()}`;
                            break;
                    }
                return ( <div>
                <li key = {goal.id}  style={{ whiteSpace: 'pre-line' }}>{goal.goal} {message}</li> 
                <p>{Math.round((goal.done.length + goal.failed.length)*100/(goal.toDo.length +goal.done.length + goal.failed.length))}% complete </p>
                <p>{Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}% success rate so far </p>
                <button onClick = {() => setDelGoal(goal.id!)}>Delete</button>
                {delGoal === goal.id && (
                <div className = "overlay" onClick={() => setDelGoal(null)}>
                <div className='modal' onClick = {(e) => e.stopPropagation()}>
                    <h2> Are you sure you want to delete the goal: {goal.goal}</h2>
                    <div className = "checkButtons">
                    <button className = 'submitB' onClick = {() => handleDelete(goal.id!)}>Confirm</button>
                    <button className = 'closeB' type='button' onClick={() => setDelGoal(null)}>Cancel</button>
                    </div>
                    </div>
                </div>
    )}
                </div>

            );
        })}
        </ul>
            )}
        </div>
        <div>
            <h2>Upcoming Tasks</h2>
            <select value = {Selection} onChange={handleChange}>
                <option value = "0">Today</option>
                <option value = "7">Next 7 Days</option>
                <option value = "30">Next 30 Days</option>
                <option value = "9999">All</option>
            </select>
            {goals.length === 0 ? (
                <h4>No Goals Yet</h4>
            ) : (
                <ul>
                    {Object.keys(map).sort(
                        (a,b) => {
                            const one = new Date(a);
                            const two = new Date(b);
                            return one.getTime() - two.getTime()
                        }
                    ).filter(dateNum => {
                        const date = toLocal(new Date(dateNum));
                        const diff = (date.getTime() - today.getTime())/(1000*60*60*24);
                        return diff <= parseInt(Selection);
                    }).map(date => (
                        <li key = {date}>
                            {new Date(date) === today ? "TODAY" : date}
                            <ul>
                                {map[date].map(goal => (
                                    <li key={goal.id}>{toLocal(new Date(date)) <= today ? (<>{goal.goal} <br/> <button onClick = {() => handleComplete(goal.id!, goal.end, date, "c")}>Mark as done</button> <button onClick = {() => handleComplete(goal.id!, goal.end, date, "f")}>Mark as failed</button></>) : goal.goal}</li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>

            )}
        </div>
        <div>
            <h2> Completed Goals </h2>
           {compGoals.length === 0 ? (
                <h4>No Goals Yet</h4>
            ) : (
                <ul>
                {compGoals.map(goal => {
                    let message = ``
                    switch (goal.frequency){
                        case "Once":
                            message = `Goal: ${goal.goal} once`;
                            break;
                        case "Daily":
                            message = `Goal: ${goal.goal} Daily for ${goal.done.length+goal.failed.length} Days with a ${Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}% success rate`;
                            break;
                        case "Weekly":
                            message = `Goal: ${goal.goal} Weekly for ${goal.done.length+goal.failed.length} Weeks with a ${Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}% success rate`;
                            break;
                        case "Monthly":
                            message = `Goal: ${goal.goal} Monthly for ${goal.done.length+goal.failed.length} Months with a ${Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}% success rate`;
                            break;
                    }
                return ( <div>
                <li key = {goal.id}  style={{ whiteSpace: 'pre-line' }}> {message}</li> 
                <p>{Math.round((goal.done.length + goal.failed.length)*100/(goal.toDo.length +goal.done.length + goal.failed.length))}% complete </p>
                <p>{Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}% success rate so far </p>
                <button onClick = {() => setDelGoal(goal.id!)}>Clear</button>
                {delGoal === goal.id && (
                <div className = "overlay" onClick={() => setDelGoal(null)}>
                <div className='modal' onClick = {(e) => e.stopPropagation()}>
                    <h2> Are you sure you want to delete the goal: {goal.goal}</h2>
                    <div className = "checkButtons">
                    <button className = 'submitB' onClick = {() => handleDelete(goal.id!)}>Confirm</button>
                    <button className = 'closeB' type='button' onClick={() => setDelGoal(null)}>Cancel</button>
                    </div>
                    </div>
                </div>
    )}
                </div>

            );
        })}
        </ul>
            )}
            
        </div>
        </div>
    )
}


interface Goals {
    id?: string;
    goal: string;
    frequency: Freq;
    start: Date;
    end: Date;
    userId: string;
    toDo: Date[];
    done: Date[];
    failed: Date[];
}

function GoalForm({user} : {user:any}) {
    const [error, setError] = useState<string>("");
    const [confirm, setConfirm] = useState(false);

    const [goalData, setGoalData] = useState<Goals>({
        goal: "",
        frequency: "Once",
        start: new Date(),
        end: new Date(),
        userId: "",
        toDo: [],
        done: [],
        failed: []
    });

    
    const userId = user?.uid;

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const {name, value} = e.target;
        if (name === "start" || name === "end"){
            if (goalData.frequency === "Once") {
                goalData.end = goalData.start;
            }
            const localDate = new Date(value + "T00:00:00")
            setGoalData((prev) => ({...prev, [name]: localDate}));
        }
        else{
            setGoalData((prev) => ({...prev, [name]: value,}));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        if (!user){
        setError("You need to be signed in")
        }   
        setConfirm(false);
        e.preventDefault();
        if (!goalData.goal || !goalData.end || !goalData.frequency || !goalData.start){
            setError("Ensure all fields are filled");
            return;
        }


        try {
            await addDoc(collection(db, "goal"), {
                ...goalData,
                userId
            });
        } catch(error){
            console.error("error: ", error);
        }
    }


    let message = ``

    const dates = mapGoals(goalData);
    goalData.toDo = dates;

    if (goalData.frequency === "Once") {
        message = ``;
        } 

    else if (goalData.frequency === "Daily"){
        const diffDays = Math.floor((goalData.end.getTime() - goalData.start.getTime()) / (1000*60*60*24) + 1);
        message = `for ${diffDays} day(s) starting`;
    }
    else if (goalData.frequency === "Weekly") {
        const diffDays = Math.floor((goalData.end.getTime() - goalData.start.getTime()) / (1000*60*60*24*7) + 1);
        message = `once a week for ${diffDays} Week(s) starting`;
    }
    else {
        const diffDays = Math.floor((goalData.end.getTime() - goalData.start.getTime()) / (1000*60*60*24*30) + 1);
        message = `once a month for ${diffDays} Month(s) starting`;
    }


    return (
        <form onSubmit={handleSubmit}>
            {error && <p style ={{color:"red"}}> {error}</p>}

            <div>
                <label> What is Your Goal? <br/>
                <textarea name = "goal" value = {goalData.goal} onChange = {handleChange}/>  
                </label>
            </div>
            <br/>
            <div>
                <label> How often are you planning to meet this goal? <br/>
                <select name = "frequency" value = {goalData.frequency} onChange={handleChange}>
                    <option value = "Once">Once</option>
                    <option value = "Daily">Daily</option>
                    <option value = "Weekly">Weekly</option>
                    <option value = "Monthly">Monthly</option>
                </select>
                </label>
            </div>
            <br/>
            <div>
                <label> Start Date 
                    <input type = "date" name = "start" value = {toLocal(goalData.start).toLocaleDateString()} onChange = {handleChange} />
                </label>
                {goalData.frequency !== "Once" &&(
                <label> End Date 
                    <input type = "date" name = "end" value = {toLocal(goalData.end).toLocaleDateString()} min = {toLocal(goalData.start).toLocaleDateString()} onChange = {handleChange} />
                </label>
                )}
            </div>
            <br/>
            <button type='button' onClick={() => setConfirm(true)}>Set my goal</button>
            {confirm && (
            <div className = "overlay" onClick={() => setConfirm(false)}>
                <div className='modal' onClick = {(e) => e.stopPropagation()}>
                    <h2> You are planning on: <b>{goalData.goal}</b> {message} on {goalData.start.toDateString()}</h2>
                    <div className = "checkButtons">
                    <button className = 'submitB' type='submit'>Confirm</button>
                    <button className = 'closeB' type='button' onClick={() => setConfirm(false)}>Cancel</button>
                    </div>
                    </div>
                </div>
    )
    }
        </form>
    )
}

function GetDaily(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
         dates.push(new Date(current));
        
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function GetWeekly(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
            dates.push(new Date(current));
        
        current.setDate(current.getDate() + 7);
    }
    return dates;
}

function GetMonthly(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);
    const day = start.getDate();

    
    while (current <= end) {
        dates.push(new Date(current));
        const next = new Date(current);
        next.setDate(day);
        const month = current.getMonth() + 1;
        const finalDay = new Date(next.getFullYear(), month+1, 0).getDate();
        next.setDate(Math.min(day, finalDay))
        next.setMonth(month)
        current = next;
    }

    return dates;
}

function mapGoals(goal : Goals): Date[] {
    let dates: Date[] = []
    
    if (goal.frequency === "Daily") {
        dates = GetDaily(goal.start, goal.end)
    } 
    else if (goal.frequency === "Weekly") {
        dates = GetWeekly(goal.start, goal.end)
    }
    else if (goal.frequency === "Monthly") {
        dates = GetMonthly(goal.start, goal.end)
    }
    else {
        dates = [goal.start]
    }
    return dates;
}

async function getGoals(goal : Goals): Promise<Date[]> {
    let dates: Date[] = []
    const goalLoc = doc(db, "goal", goal.id!)
    const goalDoc = await getDoc(goalLoc)
    const goalData = goalDoc.data()
    dates = goalData?.toDo
    return dates;
}

function toLocal(date: Date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return local;
}


export default Dash