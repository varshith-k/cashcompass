--!nonstrict
-- Presentation only. The client never calculates, edits, or submits money/score.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local player = Players.LocalPlayer
local remotes = ReplicatedStorage:WaitForChild("MoneyQuest")
local request = remotes:WaitForChild("Request")
local update = remotes:WaitForChild("Update")
local C = {
    navy = Color3.fromRGB(0, 73, 119), blue = Color3.fromRGB(2, 118, 177),
    teal = Color3.fromRGB(15, 118, 110), red = Color3.fromRGB(208, 48, 39),
    white = Color3.fromRGB(255, 255, 255), soft = Color3.fromRGB(245, 248, 252),
    ink = Color3.fromRGB(16, 42, 67), muted = Color3.fromRGB(82, 100, 119),
    border = Color3.fromRGB(223, 231, 239), pale = Color3.fromRGB(235, 244, 250),
}
local function make(className, parent, properties)
    local item = Instance.new(className)
    for key, value in properties do item[key] = value end
    item.Parent = parent
    return item
end
local function round(parent, radius)
    make("UICorner", parent, { CornerRadius = UDim.new(0, radius or 12) })
end
local function pad(parent, amount)
    make("UIPadding", parent, {
        PaddingTop = UDim.new(0, amount), PaddingBottom = UDim.new(0, amount),
        PaddingLeft = UDim.new(0, amount), PaddingRight = UDim.new(0, amount),
    })
end
local function text(parent, value, size, color, height)
    return make("TextLabel", parent, {
        BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, height or 24),
        AutomaticSize = if height then Enum.AutomaticSize.None else Enum.AutomaticSize.Y,
        Text = value, TextSize = size or 15, TextColor3 = color or C.ink,
        Font = Enum.Font.Gotham, TextWrapped = true,
        TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Center,
    })
end
local function list(parent, gap)
    make("UIListLayout", parent, { Padding = UDim.new(0, gap or 10), SortOrder = Enum.SortOrder.LayoutOrder })
end
local function money(cents)
    local amount = math.abs(cents) / 100
    local whole = tostring(math.floor(amount))
    local formatted = whole:reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", "")
    return (if cents < 0 then "-$" else "$") .. formatted .. (if cents % 100 ~= 0 then string.format(".%02d", math.abs(cents) % 100) else "")
end

local gui = make("ScreenGui", player:WaitForChild("PlayerGui"), {
    Name = "MoneyQuestHUD", ResetOnSpawn = false, IgnoreGuiInset = false,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
})
local hud = make("Frame", gui, {
    Position = UDim2.fromOffset(12, 12), Size = UDim2.new(1, -24, 0, 132),
    BackgroundColor3 = C.white, BorderSizePixel = 0,
})
round(hud, 16)
pad(hud, 12)
make("UISizeConstraint", hud, { MaxSize = Vector2.new(780, 132) })
local header = text(hud, "MONEYQUEST  /  Connecting…", 15, C.navy, 24)
header.Font = Enum.Font.GothamBold
header.Size = UDim2.new(1, -60, 0, 24)
local sync = make("TextButton", hud, {
    Text = "Sync", TextSize = 12, TextColor3 = C.navy, Font = Enum.Font.GothamBold,
    Size = UDim2.fromOffset(52, 32), Position = UDim2.new(1, -52, 0, -4),
    BackgroundColor3 = C.pale, BorderSizePixel = 0,
})
round(sync, 8)
local statLabels = {}
for index, spec in {{"Balance", C.ink}, {"Safe to spend", C.teal}, {"Savings / $400", C.blue}} do
    local frame = make("Frame", hud, {
        Position = UDim2.new((index - 1) / 3, 0, 0, 38), Size = UDim2.new(1 / 3, -6, 0, 60),
        BackgroundTransparency = 1,
    })
    text(frame, spec[1], 11, C.muted, 20)
    local value = text(frame, "—", 23, spec[2], 32)
    value.Font = Enum.Font.GothamBold
    value.Position = UDim2.fromOffset(0, 23)
    statLabels[index] = value
end
local billTicker = text(hud, "Known bills will appear here.", 11, C.muted, 16)
billTicker.Position = UDim2.fromOffset(0, 99)
local objective = make("TextButton", gui, {
    Position = UDim2.fromOffset(12, 152), Size = UDim2.new(1, -24, 0, 58),
    BackgroundColor3 = C.navy, BorderSizePixel = 0, Font = Enum.Font.GothamMedium,
    TextSize = 14, TextWrapped = true, TextColor3 = C.white,
    Text = "Walk with WASD. Explore a station with E, or tap its prompt.",
})
round(objective, 12)
pad(objective, 10)
make("UISizeConstraint", objective, { MaxSize = Vector2.new(780, 58) })

local toast = make("TextLabel", gui, {
    AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -16),
    Size = UDim2.new(1, -32, 0, 66), BackgroundColor3 = C.navy,
    BackgroundTransparency = 0.08, BorderSizePixel = 0, TextColor3 = C.white,
    Font = Enum.Font.Gotham, TextSize = 13, TextWrapped = true,
    Text = "All money is fictional. No real accounts, Robux, or purchases.",
})
round(toast, 12)
pad(toast, 12)
make("UISizeConstraint", toast, { MaxSize = Vector2.new(620, 66) })

local shade = make("Frame", gui, {
    Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0),
    BackgroundTransparency = 0.45, BorderSizePixel = 0, Visible = false, ZIndex = 8,
})
local modal = make("Frame", gui, {
    AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.56),
    Size = UDim2.new(1, -24, 1, -170), BackgroundColor3 = C.white,
    BorderSizePixel = 0, Visible = false, ZIndex = 10,
})
round(modal, 16)
make("UISizeConstraint", modal, { MaxSize = Vector2.new(680, 650) })
local title = text(modal, "", 19, C.navy, 52)
title.Font = Enum.Font.GothamBold
title.Position = UDim2.fromOffset(18, 4)
title.Size = UDim2.new(1, -78, 0, 52)
local close = make("TextButton", modal, {
    Text = "Close", TextSize = 12, TextColor3 = C.muted, Font = Enum.Font.GothamMedium,
    Size = UDim2.fromOffset(52, 44), Position = UDim2.new(1, -62, 0, 8),
    BackgroundTransparency = 1,
})
local scroll = make("ScrollingFrame", modal, {
    Position = UDim2.fromOffset(0, 60), Size = UDim2.new(1, 0, 1, -68),
    BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 5,
    ScrollBarImageColor3 = C.blue, CanvasSize = UDim2.fromOffset(0, 0),
    AutomaticCanvasSize = Enum.AutomaticSize.Y,
})
pad(scroll, 16)
list(scroll, 12)
local snapshot = nil
local pending = false
local showResults = true
local highlight = make("Highlight", gui, {
    Name = "NextStation", FillColor = Color3.fromRGB(83, 181, 237),
    FillTransparency = 0.65, OutlineColor = C.white, Enabled = false,
})

local function showModal(visible)
    modal.Visible = visible
    shade.Visible = visible
end
close.Activated:Connect(function()
    if pending then return end
    showResults = false
    showModal(false)
end)
local function clearContent()
    for _, child in scroll:GetChildren() do
        if child:IsA("GuiObject") then child:Destroy() end
    end
    scroll.CanvasPosition = Vector2.zero
end
local function send(action, choiceId)
    if pending or not snapshot then return end
    pending = true
    toast.Text = "Checking your choice with the game server…"
    request:FireServer({ action = action, choiceId = choiceId, roundId = snapshot.roundId, revision = snapshot.revision })
    task.delay(4, function()
        if pending then
            toast.Text = "Checking the current round. Use Sync if the connection is interrupted."
            request:FireServer({ action = "sync" })
        end
    end)
end
local function action(label, detail, callback, primary)
    local button = make("TextButton", scroll, {
        Size = UDim2.new(1, -4, 0, 86), Text = "", BorderSizePixel = 0,
        BackgroundColor3 = if primary then C.blue else C.pale,
        AutoButtonColor = true,
    })
    round(button, 10)
    pad(button, 12)
    local heading = text(button, label, 14, if primary then C.white else C.navy, 25)
    heading.Font = Enum.Font.GothamBold
    local description = text(button, detail, 12, if primary then C.white else C.muted, 38)
    description.Position = UDim2.fromOffset(0, 27)
    button.Activated:Connect(callback)
end
local function section(value)
    local heading = text(scroll, value, 14, C.navy)
    heading.Font = Enum.Font.GothamBold
end
local function billsAndOutlook(data)
    section("Bills and obligations")
    for _, bill in data.bills do
        local status = if bill.paidDay then "paid day " .. bill.paidDay else "due day " .. bill.dueDay
        text(scroll, bill.name .. "  " .. money(bill.amount) .. "  /  " .. status, 13, C.muted)
    end
    section("If no more optional purchases are made")
    text(scroll, "Month-end checking: " .. money(data.conservative) .. " without unreceived roommate money; " .. money(data.expected) .. " if it arrives. Includes known unpaid bills and guaranteed pay, with no future savings transfer assumed. A deferred laptop is reserved until its safety check.", 13, C.muted)
    text(scroll, "Safe to spend holds back known bills before the next paycheck (or month-end), remaining goal savings, a $300 cash buffer, and any scheduled laptop purchase. Surprise costs become known when they occur.", 12, C.muted)
end

local function render(data)
    snapshot = data
    pending = false
    header.Text = "MONEYQUEST  /  DAY " .. data.day .. " OF 30"
    statLabels[1].Text = money(data.balance)
    statLabels[1].TextColor3 = if data.balance < 0 then C.red else C.ink
    statLabels[2].Text = money(data.safeToSpend)
    statLabels[3].Text = money(data.savings)
    local unpaid = 0
    local nextBill = nil
    for _, bill in data.bills do
        if not bill.paidDay then
            unpaid += 1
            if not nextBill or bill.dueDay < nextBill.dueDay then nextBill = bill end
        end
    end
    billTicker.Text = if nextBill then string.format("%d unpaid  /  Next: %s %s, due day %d", unpaid, nextBill.name, money(nextBill.amount), nextBill.dueDay) else "All known bills paid. Review your month."
    toast.Text = data.message or "All money is fictional. Walk to the highlighted station and press E, or tap Explore."
    objective.Text = if data.finished then "Month complete  /  Tap here to view your results" else
        string.format("%d/%d  GO TO %s  /  %s", data.objective.index, data.objective.total, string.upper(data.objective.station), data.objective.title)
    local world = Workspace:FindFirstChild("MoneyQuestWorld")
    local model = world and world:FindFirstChild(data.objective.station)
    highlight.Adornee = model
    highlight.Enabled = model ~= nil and not data.finished
    clearContent()
    if data.finished and data.result then
        title.Text = data.result.title
        local score = text(scroll, tostring(data.result.score) .. " / 100", 42, if data.result.won then C.teal else C.navy, 60)
        score.Font = Enum.Font.GothamBold
        text(scroll, "Final checking: " .. money(data.balance) .. "   |   Goal savings: " .. money(data.savings), 15, C.ink)
        text(scroll, "Lowest checking balance: " .. money(data.lowestBalance) .. "   |   Laptop fund: " .. money(data.laptopFund), 13, C.muted)
        text(scroll, string.format("Bills paid: %d/%d   |   On time: %d/%d   |   Laptop owned: %s", data.result.billsPaid, data.result.totalBills, data.result.billsOnTime, data.result.totalBills, if data.hasLaptop then "yes" else "no"), 13, C.muted)
        section("How your score works")
        for _, component in data.result.components do
            text(scroll, string.format("%s: %.1f / %d", component.label, component.points, component.maximum), 13, C.muted)
        end
        section("Three lessons to take with you")
        for index, lesson in data.result.lessons do text(scroll, index .. ". " .. lesson, 14, C.ink) end
        action("Play Again", "Start a fresh fictional month and try different choices.", function() send("replay") end, true)
        showModal(showResults)
    elseif data.decision then
        title.Text = data.decision.title
        text(scroll, data.decision.body, 15, C.ink)
        for _, choice in data.decision.choices do
            action(choice.label, choice.detail, function() send("choose", choice.id) end, false)
        end
        billsAndOutlook(data)
        showModal(true)
    elseif data.message then
        title.Text = "Your month, at a glance"
        text(scroll, data.message, 15, C.ink)
        billsAndOutlook(data)
        section("Recent activity")
        for index = math.max(1, #data.log - 5), #data.log do text(scroll, data.log[index], 13, C.muted) end
        showModal(true)
    else
        showModal(false)
    end
end
update.OnClientEvent:Connect(function(data)
    if typeof(data) ~= "table" then return end
    if snapshot and data.roundId ~= snapshot.roundId then showResults = true end
    if data.finished and snapshot and not snapshot.finished then showResults = true end
    render(data)
end)
objective.Activated:Connect(function()
    if not snapshot or pending then return end
    if snapshot.finished then showResults = true; render(snapshot)
    else
        toast.Text = "Next stop: " .. snapshot.objective.station .. ". Use WASD to walk, then E or the Explore prompt."
    end
end)
sync.Activated:Connect(function() request:FireServer({ action = "sync" }) end)
request:FireServer({ action = "sync" })
