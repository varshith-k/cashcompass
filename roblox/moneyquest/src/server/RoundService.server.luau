--!nonstrict
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Engine = require(script.Parent.FinanceEngine)
local Scoring = require(script.Parent.Scoring)
local Protocol = require(script.Parent.Protocol)
local World = require(script.Parent.World)
local world = World.build()

-- Rojo supplies these; create them too for the documented manual Studio import.
local remotes = ReplicatedStorage:FindFirstChild("MoneyQuest") or Instance.new("Folder")
remotes.Name = "MoneyQuest"
remotes.Parent = ReplicatedStorage
local function remote(name)
    local value = remotes:FindFirstChild(name) or Instance.new("RemoteEvent")
    value.Name = name
    value.Parent = remotes
    return value
end
local request = remote("Request")
local update = remote("Update")
local sessions = {}

local function isNear(player, stationId)
    local anchor = world.stations[stationId]
    local character = player.Character
    local root = character and character:FindFirstChild("HumanoidRootPart")
    local humanoid = character and character:FindFirstChildOfClass("Humanoid")
    return anchor and root and humanoid and humanoid.Health > 0
        and (root.Position - anchor.Position).Magnitude <= 15
end

local function publish(player, message)
    local session = sessions[player]
    if not session then return end
    local state = session.state
    local phase = Engine.phase(state)
    local conservative, expected = Engine.outlook(state)
    local bills = {}
    -- Fixed order makes the UI deterministic too.
    for _, id in {"rent", "groceries", "utilities", "emergency"} do
        if id ~= "emergency" or state.phaseIndex >= 5 then
            local bill = state.bills[id]
            table.insert(bills, { name = bill.name, amount = bill.amount, dueDay = bill.dueDay, paidDay = bill.paidDay })
        end
    end
    -- Send a view of this player's state, never an editable server reference.
    update:FireClient(player, {
        roundId = state.roundId, revision = state.revision, day = state.day,
        balance = state.balance, savings = state.savings, laptopFund = state.laptopFund,
        safeToSpend = Engine.safeToSpend(state), lowestBalance = state.lowestBalance,
        conservative = conservative, expected = expected,
        finished = state.finished, hasLaptop = state.hasLaptop,
        bills = bills, log = state.log,
        objective = { station = phase.station, title = phase.title, index = state.phaseIndex, total = #Engine.PHASES },
        decision = if not state.finished and session.activeStation == phase.station and isNear(player, phase.station) then phase else nil,
        result = if state.finished then Scoring.compute(state, Engine.RULES) else nil,
        message = message,
    })
end

local function addPlayer(player)
    if sessions[player] then return end
    sessions[player] = { state = Engine.new(1), lastRequest = -math.huge, activeStation = nil }
    player.CharacterAdded:Connect(function()
        local session = sessions[player]
        if session then session.activeStation = nil end
        -- A respawn keeps the financial round; it cannot wipe a bad decision.
    end)
end
Players.PlayerAdded:Connect(addPlayer)
Players.PlayerRemoving:Connect(function(player) sessions[player] = nil end)
for _, player in Players:GetPlayers() do addPlayer(player) end

for id, anchor in world.stations do
    anchor.VisitStation.Triggered:Connect(function(player)
        local session = sessions[player]
        if not session or not isNear(player, id) then return end
        local now = os.clock()
        if now - session.lastRequest < 0.15 then return end
        session.lastRequest = now
        session.activeStation = id
        local phase = Engine.phase(session.state)
        publish(player, if phase.station ~= id then "Welcome to " .. id .. ". Your next challenge is at " .. phase.station .. "." else nil)
    end)
end

request.OnServerEvent:Connect(function(player, payload)
    local session = sessions[player]
    if not session or typeof(payload) ~= "table" then return end
    local now = os.clock()
    if now - session.lastRequest < 0.15 then return end
    session.lastRequest = now
    local state = session.state
    local phase = Engine.phase(state)
    local action, reason = Protocol.authorize(state, payload,
        session.activeStation == phase.station and isNear(player, phase.station) or false)
    if not action then publish(player, reason); return end
    if action == "sync" then publish(player); return end
    if action == "replay" then
        session.state = Engine.new(state.roundId + 1)
        session.activeStation = nil
        if player.Character then player.Character:PivotTo(world.spawnCFrame) end
        publish(player, "New month. Try different choices!")
        return
    end
    local ok, choiceError = Engine.choose(state, payload.choiceId)
    if not ok then publish(player, choiceError); return end
    session.activeStation = nil
    publish(player, state.log[#state.log])
end)
