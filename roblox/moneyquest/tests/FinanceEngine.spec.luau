--!strict
-- Run from this folder with the official standalone Luau CLI, not a Lua interpreter.
local Engine = require("../src/server/FinanceEngine")
local Scoring = require("../src/server/Scoring")
local Protocol = require("../src/server/Protocol")
local checks = 0
local function check(condition: boolean, message: string)
    checks += 1
    assert(condition, message)
end
local function choose(state: Engine.State, value: string)
    local ok, reason = Engine.choose(state, value)
    assert(ok, reason or value)
end
local function play(path: {string}): Engine.State
    local state = Engine.new(1)
    for _, value in path do choose(state, value) end
    return state
end

local initial = Engine.new(1)
check(initial.balance == 250000 and Engine.safeToSpend(initial) == 30000, "Day-one balance must differ from safe-to-spend")
local startRevision = initial.revision
check(not Engine.choose(initial, "give-me-money"), "Unknown choice must be rejected")
check(initial.balance == 250000 and initial.revision == startRevision, "Rejected choices must not mutate state")

local patient = play({"wait", "pay", "budget", "wait", "cash", "safe", "finish"})
check(patient.finished and patient.day == 30, "Round must finish on day 30")
check(patient.balance == 50000 and patient.savings == 40000, "Reference path money must reconcile")
check(patient.lowestBalance == 30000 and patient.hasLaptop, "Waiting should preserve the buffer and still buy a laptop")
check(Scoring.compute(patient, Engine.RULES).score == 100, "Reference path should earn 100")
check(Scoring.compute(patient, Engine.RULES).won, "Reference path should meet the win conditions")

local impatient = play({"buy", "pay", "budget", "wait", "cash", "safe", "finish"})
check(impatient.balance == patient.balance, "Timing can cause a crisis even with the same final balance")
check(impatient.lowestBalance == -65000, "Buy-today path must expose the pre-payday shortfall")
check(not Scoring.compute(impatient, Engine.RULES).won, "A final recovery cannot erase a negative-balance month")
check(Scoring.compute(impatient, Engine.RULES).score < 100, "Unsafe purchase must affect the score")

local delayed = play({"wait", "delay", "budget", "wait", "delay", "safe", "finish"})
check(delayed.bills.rent.paidDay == 15 and delayed.bills.emergency.paidDay == 22, "Deferred bills must actually settle")
check(Scoring.compute(delayed, Engine.RULES).billsOnTime == 2, "Late bills must not receive on-time credit")
check(not delayed.pendingRent and not delayed.pendingEmergency, "Deferred obligations must be consumed once")

local staged = play({"fund", "pay", "budget"})
check(staged.day == 11 and staged.income == 0, "Neither payday nor promised repayment may be posted early")
local beforePromise = staged.balance
choose(staged, "plan")
check(staged.balance == beforePromise and not staged.roommatePaid, "Agreeing on repayment must not invent cash")
choose(staged, "reserve")
check(staged.salaryPaid and staged.income == 150000 and not staged.roommatePaid, "Salary must post on day 15, repayment later")
check(staged.savings == 0 and staged.laptopFund == 15000, "A laptop reserve must remain distinct from goal savings")
choose(staged, "safe")
check(staged.bills.utilities.paidDay == 20 and staged.roommatePaid and staged.income == 170000, "Utilities and roommate transfer must post once on their actual dates")
choose(staged, "finish")
check(not Engine.choose(staged, "finish"), "Finished rounds must reject further decisions")

-- All complete paths: every choice, every challenge, accounting, score bounds, determinism.
local paths = 0
local function visit(path: {string})
    local state = play(path)
    check(state.balance + state.savings + state.laptopFund == Engine.RULES.openingBalance + state.income - state.spent, "Money must be conserved after every choice")
    check(state.balance % 1 == 0 and state.savings % 1 == 0, "Financial values must remain integer cents")
    check(state.lowestBalance <= state.balance, "Lowest balance must track historical cash, not only ending cash")
    check(Engine.safeToSpend(state) >= 0, "Safe-to-spend may not be negative")
    if state.finished then
        paths += 1
        local result = Scoring.compute(state, Engine.RULES)
        check(result.score >= 0 and result.score <= 100, "Scores must stay within 0–100")
        check(result.billsPaid == 4 and state.income == 170000, "All paths must account for all bills and both real deposits")
        local repeatState = play(path)
        check(repeatState.balance == state.balance and Scoring.compute(repeatState, Engine.RULES).score == result.score, "Identical choices must produce identical outcomes")
        return
    end
    for _, option in Engine.phase(state).choices do
        local nextPath = table.clone(path)
        table.insert(nextPath, option.id)
        visit(nextPath)
    end
end
visit({})
check(paths == 324, "Every one of the 324 full decision paths must be exercised")

-- Real request guard used by the Roblox server; proximity is a server-only fact.
local state = Engine.new(10)
local request = { action = "choose", roundId = 10, revision = 0, choiceId = "buy", balance = 999999999, score = 100 }
check(Protocol.authorize(state, request, true) == "choose", "A valid choice remains valid even if irrelevant forged fields are present")
choose(state, request.choiceId)
check(state.balance == 130000, "Forged balance/score fields cannot change the authoritative financial calculation")
check(Protocol.authorize(state, request, true) == nil, "Replayed revisions must be rejected")
check(Protocol.authorize(state, { action = "choose", roundId = 10, revision = 1, choiceId = "pay" }, false) == nil, "Remote choices from another station must fail")
check(Protocol.authorize(state, { action = "replay", roundId = 10, revision = 1 }, true) == nil, "Players cannot reset an unfinished round")
check(Protocol.authorize(state, { action = "setBalance", roundId = 10, revision = 1 }, true) == nil, "Unknown remote actions must fail")
check(Protocol.authorize(state, "invalid", true) == nil, "Malformed requests must fail")
check(Protocol.authorize(state, { action = "choose", roundId = 10, revision = 1, choiceId = string.rep("x", 33) }, true) == nil, "Oversized choice IDs must fail")
local reset = Engine.new(11)
check(reset.balance == 250000 and reset.savings == 0 and reset.revision == 0 and not reset.finished, "Replay must create clean state")
check(Protocol.authorize(reset, request, true) == nil, "An old round's request must not affect a replay")
local independent = Engine.new(12)
choose(independent, "fund")
check(reset.balance == 250000, "Player sessions must not share mutable balances")

print(string.format("MoneyQuest: %d assertions passed; all %d complete decision paths verified.", checks, paths))
