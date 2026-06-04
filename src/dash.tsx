import './dash.css';
import {auth, db} from "./firebase";
import Groups from "./groups"
import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { addDoc, collection, onSnapshot, query, where, orderBy, doc, deleteDoc, getDoc, getDocs, setDoc, updateDoc, increment, arrayRemove, arrayUnion, Timestamp} from "firebase/firestore";
import { signOut, updateProfile } from "firebase/auth";


// Main dashboard to control the pages when logged in and manage logout and username changes within the goal page
function Dash({user, setUser}: {user:any, setUser:any}) {
    const [points, setPoints] = useState<number|null>(null);
    // Begins as dash page but can change state to groups, stored locally to persist through refresh
    const [page, setPage] = useState(localStorage.getItem("page") as "dash"|"groups" ||"dash");
    const [userChange, setUserChange] = useState(false)
    const [newName, setNewName] = useState("")
    const [userError, setUserError] = useState("")
    const changePage = (newP : "dash"|"groups") => {
        setPage(newP)
        localStorage.setItem("page", newP);
    }
    // Logs out by removing the value set to the user and firebase states
    const handleLogOut = async () => {
        setUser(null);
        await signOut(auth);
    }

    // Allows user to change their username, especially useful for 3rd party login where username is auto-generated as their ID
    const handleNameChange = async () => {
        setUserError("");
        // Checks if the username exists to ensure every user has a unique one
          const nameCheck = query(collection(db, "userInfo"), where("username", "==", newName));
          const duplicate = await getDocs(nameCheck);
          if (!duplicate.empty) {
            setUserError("Username Taken")
            return;
          }
          // Updates firestore username in user data folder
          await updateDoc(doc(db, "userInfo", user.uid), {
            username: newName
          })
          // Updates username as part of firestore user
          await updateProfile(user, {displayName: newName})
          
          setUserError("Username Changed!")
    }
    
    // Loading shown if a user is nto defined yet
    if (user === undefined) return <p>Loading...</p>;

    return (
        <div className="fullpage">
            <div className='content'>
            {page === "dash" && ( <div className='mainlogin'>
            {/* Main page control buttons including Log out, change pages and username change */}
            <button className='topB logout' onClick={handleLogOut}>Log out</button>
            <button className='topB groups' onClick={()=> changePage("groups")}>Groups</button>
            <button className='topB cu' onClick={()=> setUserChange(true)}>Change Username</button>
            {/* Calls other functions which are the main display of the page */}
            <UserInfo user = {user} points = {points} setPoints = {setPoints}/>
            <GoalForm user = {user}/>
            <Feed user = {user} setPoints = {setPoints}/>
            </div>
            )}

            {page === "groups" && (<>
                <Groups changePage={changePage} user = {user}/>
            </>)
            }

            {/* Modal for when user wants to change username */}
            {userChange && (<div className = "overlay" onClick={() => setUserChange(false)}>
                <div className='modal' onClick = {(e) => e.stopPropagation()}>
                    <h2>New username: </h2>
                    <input className='newusername' value = {newName} onChange={(e) => setNewName(e.target.value)}/>
                    <button className='submitB' onClick={() => handleNameChange()}>Confirm</button>
                    <p>{userError}</p>
                    </div>
                </div>)}

</div>
        </div>
    )
}

// Goals can have tasks which make them up set up in these increments 
type Freq = "Once" | "Daily" | "Weekly" | "Monthly";
type GoalMap = {
        [date:string]: Goals[];
    }

// Creates a current local time variable for later reference and comparison
const today = toLocal(new Date());

// Provides a header with a welcome message and the number of points a user has
function UserInfo ({user, points, setPoints} : {user:any, points:number|null, setPoints:React.Dispatch<React.SetStateAction<number|null>>}){
    useEffect(() => { 
        const getUser = async () => {
            const a = doc(db, "userInfo", user.uid);
            const b = await getDoc(a);
            if (b.exists()){
            setPoints(b.data().points)}
        }
        getUser();
    },
    [user]
)


    return (
        <>
        <h4 className='points'>Your points: {points} </h4>
        <h3 className='welcome'>Welcome {user.displayName}!</h3>
        </>
    )
}

// Function which displays information about current and past goals. Includes current goals, upcoming takss and completed goals
function Feed({user, setPoints} : {user:any, setPoints:React.Dispatch<React.SetStateAction<number|null>>}){

    const [Selection, changeSelection] = useState('0')
    const [postGroup, changePostGroup] = useState<string>("");

    // When a user wants to delete a goal they have not completed
    const handleDelete = async (id: string, typeDel: string) => {
        await deleteDoc(doc(db, typeDel, id));
        setGoals(prev => prev.filter(goal => goal.id !== id));
        setDelGoal(null);
    }

    // Used when a user marks a task as finished. Increments points, updates list of completed/failed tasks in firestore and marks the goal as complete if it is the final task
    const handleComplete = async (id: string, current: string, change: string) => {
        const date = new Date(current);
        const fireDate = Timestamp.fromDate(date);
        const ogCol = doc(db, "goal", id);
        const goalD = await getDoc(ogCol);
        const newLength = goalD.data()!.toDo.length - 1;
        const a = doc(db, "userInfo", user.uid);
        
        // If markerd as completed points are incremented by 1, moved to complete list
        if (change === "c") {
            setPoints(points => (points ?? 0) +1)

            await updateDoc(a, {
            points: increment(1)
            }
        )
            await updateDoc(ogCol, {
                toDo: arrayRemove(fireDate),
                done: arrayUnion(fireDate)
            });
        }

        // If marked as failed points are decremented by 1, moved to fail list
        else {
            setPoints(points => (points ?? 0) -1)
            await updateDoc(a, {
            points: increment(-1)
            }
            )
            
            await updateDoc(ogCol, {
                toDo: arrayRemove(fireDate),
                failed: arrayUnion(fireDate)
            });
        }
        
        // Moved to compGoal folder when all tasks are marked
        if (newLength === 0) {
            const goal = await getDoc(ogCol);
            const newCol = doc(db, "compGoal", id);
            await setDoc(newCol, {...goal.data(), 
                // Saves the total points earned as an attribute to calculate significance
                pointsEarned: (goal.data()?.done.length ??0) - (goal.data()?.failed.length ??0)});
            await deleteDoc(ogCol);
        }
    }


    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        changeSelection(e.target.value);
    }
    const handleFilter = (e: ChangeEvent<HTMLSelectElement>) => {
        setFilterLen(e.target.value as "most"|"recent");
    }
    const handlePostP = (e: ChangeEvent<HTMLSelectElement>) => {
        changePostGroup(e.target.value);
    }

    // Posts a completed goal to the selected group, increases the groups popularity score by 1
    const handlePost = async (message: string, groupId:string) => {
        await addDoc(collection(db, "group", groupId, "posts"), {
           content: "I've completed " + message,
           date: toLocal(new Date()),
           likeIds: [],
           userId: user.uid,
           username: user.displayName
        })
        await updateDoc(doc(db, "group", groupId), {
            popCount: increment(1)
        })
    }

    const [groupL, setGroupL] = useState<Groups[]>([]);
    const [userGroups, setUserGroups] = useState<string[]>([])

    // Load all of the user's joined group IDs, needed when sharing so only joined groups can be shared to
    useEffect(() => {
        // Loads all groups from firestore, needed to get names in association with IDs for the selection although likely inefficient at scale
        const load = async () => {
        const groups = await getDocs(collection(db, "group"));
        const groupList: Groups[] = groups.docs.map(docu =>
        ({id: docu.id, ... (docu.data() as Omit<Groups, "id">)}));
        setGroupL(groupList)
        // Gets all of the IDs of the user's joined groups
        const infoDoc = doc(db, "userInfo", user.uid);
        const getDocc = await getDoc(infoDoc);
        const gList = getDocc.get("joinedGroups");
        setUserGroups(gList);
    
    };
        load();
    }, [])

    // Goals which are pending share or deleting
    const [shareGoal, setShareGoal] = useState<string|null>(null)
    const [delGoal, setDelGoal] = useState<string|null>(null);
    // Sorting for which completed goals to show first
    const [filterLen, setFilterLen] = useState<"most"|"recent">("recent");

    if (!user?.uid) return;

    // Set of goals and completed goals which are displayed to the user
    const [goals, setGoals] = useState<Goals[]>([]);
    const [compGoals, setCompGoals] = useState<Goals[]>([]);

    // Listner for current goals, gets all attributes and displays them. toDo is dates used for upcoming tasks. Done and failed used for success rate. 
    useEffect(() => {
        const goalsCol = collection(db, "goal");
        const find = query(
            goalsCol, where ("userId", "==", user?.uid),
            // Most resent goals are shown first
            orderBy("start", "asc")
        );
        const unsub = onSnapshot(find, snapshot => {
            const goalsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Goals),
                start: doc.data().start.toDate(),
                end: doc.data().end.toDate(),
                // Converts to JS dates from firestore timestamps
                toDo: doc.data().toDo.map((date:any) => date.toDate()),
                done: doc.data().done.map((date:any) => date.toDate()),
                failed: doc.data().failed.map((date:any) => date.toDate())
            }));
            setGoals(goalsList);
        });
        return unsub;
    }, [user]);

    // Listener for archived goals, updates whenever a goal is completed, data retrieved is used mostly for display of achieved goals and their attributes
    useEffect(() => {
        const goalsCol = collection(db, "compGoal");
        const find = query(
            goalsCol, where ("userId", "==", user?.uid),
            // Most recently started goals are shown first
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
    
    // Used to map number days from date object to readable day of the week
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Map of days to goals to be completed on the day for grouping in the upcoming taks section
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
        <div className='progressfull'>
        <h1>Your Progress</h1>
        <div className='goalist'>

        {/* Current Goals column */}
        <div className='currentg'>
            <h2>Current Goals 📓</h2>
            {goals.length === 0 ? (
                <h4>No Goals Yet</h4>
            ) : (
                <ul>
                {/* Creates nicely formatted text from goal data for easy display, includes frequency, start and end */}
                {goals.map(goal => {
                    let message = ``
                    switch (goal.frequency){
                        case "Once":
                            message = `on ${goal.start.toDateString()}`;
                            break;
                        case "Daily":
                            message = `\nEvery Day\n ${goal.start.toDateString()} to ${goal.end.toDateString()}`;
                            break;
                        case "Weekly":
                            message = `Every Week on ${days[goal.start.getDay()]}\n from ${goal.start.toDateString()} to ${goal.end.toDateString()}`;
                            break;
                        case "Monthly":
                            message = `Every Month on Day ${goal.start.getDate()}\n from ${goal.start.toDateString()} to ${goal.end.toDateString()}`;
                            break;
                    }
                return ( 
                <div className='curitem'>
                <li className = 'totalgoals' key = {goal.id}  style={{ whiteSpace: 'pre-line' }}><b>{goal.goal}</b> {message}</li> 
                {/* Calculates and displays the percentage of tasks in a goal complete by combining failed & completed tasks and dividing by all tasks*/}
                <p>{Math.round((goal.done.length + goal.failed.length)*100/(goal.toDo.length +goal.done.length + goal.failed.length))}% complete </p>
                {/* Shows a progress bar for an easy visualization of progress */}
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(goal.done.length + goal.failed.length) * 100 / (goal.toDo.length + goal.done.length + goal.failed.length)}%` }}                    />
                    </div>
                {/* Measures the ratio of succeeded to failed task for a goal, if there are none an automatic 100% is given until progress is made */}
                <p>{goal.done.length + goal.failed.length > 0 ? Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length)): "100"}% success rate so far </p>
                {/* Button and confirmation modal for deleting an uncompleted task */}
                <button className='deletebut' onClick = {() => setDelGoal(goal.id!)}>🗑️ Delete</button>
                {delGoal === goal.id && (
                <div className = "overlay" onClick={() => setDelGoal(null)}>
                <div className='modal' onClick = {(e) => e.stopPropagation()}>
                    <h2> Are you sure you want to delete the goal: {goal.goal}</h2>
                    <div className = "checkButtons">
                    <button className = 'submitB' onClick = {() => handleDelete(goal.id!, "goal")}>Confirm</button>
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
        {/* Upcoming tasks modal, every task is a part of a goal which needs to be completed set by the start date, end date, and frequency */}
        <div className='upcoming'>
            <h2>Upcoming Tasks ❗</h2>
            {/* Filters how far ahead the future tasks should show */}
            <select className='viewselect' value = {Selection} onChange={handleChange}>
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
                            // Only days which have tasks on them are shown and are sorted from oldest to furthest in the future
                            const one = new Date(a);
                            const two = new Date(b);
                            return one.getTime() - two.getTime()
                        }
                        // Filters so that only dates within the set range are shown
                    ).filter(dateNum => {
                        const date = toLocal(new Date(dateNum));
                        const diff = (date.getTime() - today.getTime())/(1000*60*60*24);
                        return diff <= parseInt(Selection);
                    }).map(date => (
                        <li className='upcomingtask' key = {date}>
                            {/* Tasks which are scheduled for the current day are clearly marked */}
                            {toLocal(new Date(date)).toDateString() === today.toDateString() ? "TODAY ‼️" : date}
                            <ul>
                                {/* List of tasks with users being able to mark today's tasks or past tasks retroactively as failed or complete, future are shown with no buttons */}
                                {map[date].map(goal => (
                                    <li className='task' key={goal.id}>{toLocal(new Date(date)) <= today ? (<><b>{goal.goal}</b> <br/> <button className='completebut' onClick = {() => handleComplete(goal.id!, date, "c")}>✅ Mark as done</button> <button className='failbut' onClick = {() => handleComplete(goal.id!, date, "f")}>❌ Mark as failed</button></>) : <b> {goal.goal} </b>}</li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>

            )}
        </div>
        {/* Column of completed goals taken from compGoal firebase folder */}
        <div className='completed'>
            <h2> Completed Goals ✅ </h2>
           {compGoals.length === 0 ? (
                <h4>No Goals Yet</h4>
            ) : (<>
            {/* Goals can either be sorted by the most recently completed or the ones which had the most impact (most tasks associated with them succeeded) */}
                 <select className= 'viewselect' value = {filterLen} onChange={handleFilter}>
                    <option value = "recent">Most Recent</option>
                    <option value = "most">Most Points Earned</option>
                </select>
                <ul>
                {compGoals.slice().sort((a,b) =>{
                    if (filterLen === "recent") {
                        return b.end.getTime() - a.end.getTime();
                    }
                    else {
                        return b.pointsEarned! - a.pointsEarned!
                    }
                }
                // Limited to the top 5 goals of the sorting method chosen
                ).slice(0,5).map(goal => {
                    let message = ``
                    // Readable way to display attributes of a goal including name, frequency, length and success rate
                    switch (goal.frequency){
                        case "Once":
                            message = `${goal.goal} \n once`;
                            break;
                        case "Daily":
                            message = `${goal.goal} \n daily\n Length: ${goal.done.length+goal.failed.length} days \n Success rate: ${Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}%`;
                            break;
                        case "Weekly":
                            message = `${goal.goal} \n weekly \n Length: ${goal.done.length+goal.failed.length} weeks \n Success rate: ${Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}%`;
                            break;
                        case "Monthly":
                            message = `${goal.goal} \n monthly \n Length: ${goal.done.length+goal.failed.length} months \n Success rate: ${Math.round((goal.done.length)*100/(goal.done.length + goal.failed.length))}%`;
                            break;
                    }
                return ( <div className='completedgoal'>
                <li key = {goal.id}  style={{ whiteSpace: 'pre-line' }}> <b> {message} </b></li> 
                {/* Additionally displays the number of points earned by the goal */}
                <p>Points Earned: {goal.pointsEarned}</p>
                {/* Clear the goal, goals which a user no longer wants to see can be removed, points are still kept to mark overall progress */}
                <button className='clearbut' onClick = {() => setDelGoal(goal.id!)}>🧹 Clear</button>
                {/* Button to share the goal with a group */}
                <button className='sharebut' onClick = {() => setShareGoal(goal.id!)}>📣 Share</button>
                {/* Modal to confirm the user wants to remove the goal from view */}
                {delGoal === goal.id && (
                <div className = "overlay" onClick={() => setDelGoal(null)}>
                <div className="modal" onClick = {(e) => e.stopPropagation()}>
                    <h2> Are you sure you want to clear the goal: {goal.goal}</h2>
                    <div className = "checkButtons">
                    <button className = 'submitB' onClick = {() => handleDelete(goal.id!, "compGoal")}>Confirm</button>
                    <button className = 'closeB' type='button' onClick={() => setDelGoal(null)}>Cancel</button>
                    </div>
                    </div>
                </div>
                
    )}
                {/* Modal to all the user to select which group to share the achievement to */}
                {shareGoal === goal.id && (
                <div className = "overlay" onClick={() => setShareGoal(null)}>
                <div className="modal" onClick = {(e) => e.stopPropagation()}>
                    <h2>Which group would you like to share this in: </h2>
                    <select className="viewselect" value = {postGroup} onChange={handlePostP}> {userGroups.map(groupId => {
                        // Finds from the list of all groups loaded to display on the dropdown
                        const group = groupL.find(g => g.id === groupId);
                        return (
                            <option key ={groupId} value = {groupId}>
                                {/* Displays group name on the selection menu */}
                                {group?.name ?? groupId}
                            </option>
                        )
                     }
                     )
                     } </select>
                     {/* Preview of the post and button to confirm */}
                     <h3>Your post: <br/><b>I've completed {message}</b> <br/></h3>
                    <button className='submitB' onClick={() => handlePost(message, postGroup)}>Post</button>

                     
                </div>
                </div>
                )}
                </div>
            );
        })}
        </ul>
        </>
            )}
            
        </div>
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
    pointsEarned?: number;
}

// Function for the user to create a goal. Allows them to set the name, freuency and start & end date
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
            // Start and end date are the same when it is a one task goal
            if (goalData.frequency === "Once") {
                goalData.end = goalData.start;
            }
            // Set date to start of the day, this allows for easy compatability when comparing to firebase timestamps
            const localDate = new Date(value + "T00:00:00")
            setGoalData((prev) => ({...prev, [name]: localDate}));
        }
        else{
            setGoalData((prev) => ({...prev, [name]: value,}));
        }
    };

    // Adds user goal to goal folder as long as all fields are filled correctly
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

    // Computes all of the task dates based on the goal length and frequency
    const dates = mapGoals(goalData);
    goalData.toDo = dates;

    // Creates a readable confirmation message for the modal when creating a goal. Displays frequency and number of tasks
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
        <form className='goalset' onSubmit={handleSubmit}>
            {error && <p style ={{color:"red"}}> {error}</p>}
            <div className='form'>
                <label> Create a new goal today! <br/></label>
                <textarea className="goalarea" name = "goal" value = {goalData.goal} onChange = {handleChange}/>  
            </div>
            <br/>
            <div className='params'>
            <div className='dropdown'>
                <label> How often are you planning to meet this goal? <br/> </label>
                <select name = "frequency" value = {goalData.frequency} onChange={handleChange}>
                    <option value = "Once">Once</option>
                    <option value = "Daily">Daily</option>
                    <option value = "Weekly">Weekly</option>
                    <option value = "Monthly">Monthly</option>
                </select>
            </div>
            <br/>
            <div className='dates'>
                <label> Start Date </label>
                    <input type = "date" name = "start" value = {toLocal(goalData.start).toISOString().split('T')[0]} onChange = {handleChange} />
                    {/* End date displayed for goals which recur */}
                {goalData.frequency !== "Once" &&(
                <>
                <label> End Date </label>
                    <input type = "date" name = "end" value = {toLocal(goalData.end).toISOString().split('T')[0]} min = {toLocal(goalData.start).toLocaleDateString()} onChange = {handleChange} />
                </>
                )}
                </div>
            </div>
            <br/>
            {/* Button opens up confirmation modal for creating a goal which displays a clear summary of the details */}
            <button type='button' className='goalsetb' onClick={() => setConfirm(true)}>Set my goal</button>
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

// Given a start and an end date this function generates a list of dates for the tasks of a goal every day from the start to end date
function GetDaily(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = toLocal(new Date(start));

    while (current <= end) {
         dates.push(new Date(current));
        
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// Given a start and an end date this function generates a list of dates for the tasks of a goal every week from the start to the end date
// The day of the week on which it occurs is set by the start date 
function GetWeekly(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = toLocal(new Date(start));

    while (current <= end) {
            dates.push(new Date(current));
        
        current.setDate(current.getDate() + 7);
    }
    return dates;
}

// Given a start and an end date this function generates a list of dates for the tasks of a goal every month from the start to end date
// Day is determined by the start day, any day which overflows (ex. set to 31st but June has 30 days) is set to the last day of that month

function GetMonthly(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = toLocal(new Date(start));
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

// Universal function for getting a list of dates given the frequency and dates of a given goal
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

// Gets local date to avoid timezone inconsistencies
function toLocal(date: Date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return local;
}


export default Dash