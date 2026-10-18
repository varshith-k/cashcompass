--!nonstrict
-- Original low-poly parts only: no marketplace models, HTTP, or asset dependencies.
local World = {}
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local COLORS = {
    navy = Color3.fromRGB(0, 73, 119), blue = Color3.fromRGB(2, 118, 177),
    teal = Color3.fromRGB(15, 118, 110), cream = Color3.fromRGB(245, 248, 252),
    grass = Color3.fromRGB(115, 164, 143), pavement = Color3.fromRGB(204, 222, 230),
}

local function part(parent, name, size, cf, color, material)
    local item = Instance.new("Part")
    item.Name = name
    item.Size = size
    item.CFrame = cf
    item.Color = color
    item.Material = material or Enum.Material.SmoothPlastic
    item.Anchored = true
    item.TopSurface = Enum.SurfaceType.Smooth
    item.BottomSurface = Enum.SurfaceType.Smooth
    item.Parent = parent
    return item
end

local function sign(anchor, title, subtitle, color)
    local gui = Instance.new("BillboardGui")
    gui.Name = "StationSign"
    gui.Size = UDim2.fromOffset(230, 64)
    gui.StudsOffset = Vector3.new(0, 9, 0)
    gui.MaxDistance = 130
    gui.AlwaysOnTop = true
    gui.Parent = anchor
    local box = Instance.new("Frame")
    box.Size = UDim2.fromScale(1, 1)
    box.BackgroundColor3 = COLORS.navy
    box.BorderSizePixel = 0
    box.Parent = gui
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 12)
    corner.Parent = box
    local heading = Instance.new("TextLabel")
    heading.Size = UDim2.new(1, -12, 0, 30)
    heading.Position = UDim2.fromOffset(6, 6)
    heading.BackgroundTransparency = 1
    heading.Text = title
    heading.TextColor3 = COLORS.cream
    heading.Font = Enum.Font.GothamBold
    heading.TextSize = 17
    heading.Parent = box
    local caption = heading:Clone()
    caption.Position = UDim2.fromOffset(6, 34)
    caption.Size = UDim2.new(1, -12, 0, 20)
    caption.Text = subtitle
    caption.TextSize = 12
    caption.TextColor3 = color
    caption.Font = Enum.Font.Gotham
    caption.Parent = box
end

function World.build()
    local prior = Workspace:FindFirstChild("MoneyQuestWorld")
    if prior then prior:Destroy() end
    local root = Instance.new("Model")
    root.Name = "MoneyQuestWorld"
    root.Parent = Workspace
    Lighting.ClockTime = 14
    Lighting.Brightness = 2
    Lighting.Ambient = Color3.fromRGB(130, 152, 172)
    Lighting.OutdoorAmbient = Color3.fromRGB(155, 176, 190)

    part(root, "Neighborhood", Vector3.new(116, 2, 112), CFrame.new(0, -1, 0), COLORS.grass, Enum.Material.Grass)
    part(root, "MainWalk", Vector3.new(104, 0.2, 14), CFrame.new(0, 0.1, 0), COLORS.pavement, Enum.Material.Concrete)
    part(root, "CrossWalk", Vector3.new(14, 0.22, 100), CFrame.new(0, 0.12, 0), COLORS.pavement, Enum.Material.Concrete)
    part(root, "Plaza", Vector3.new(22, 0.3, 22), CFrame.new(0, 0.18, 0), COLORS.cream)
    for _, x in {-54, 54} do part(root, "BoundaryHedge", Vector3.new(2, 2, 108), CFrame.new(x, 1, 0), COLORS.teal) end
    for _, z in {-52, 52} do part(root, "BoundaryHedge", Vector3.new(108, 2, 2), CFrame.new(0, 1, z), COLORS.teal) end

    local spawn = Instance.new("SpawnLocation")
    spawn.Name = "MoneyQuestSpawn"
    spawn.Size = Vector3.new(8, 0.4, 8)
    spawn.CFrame = CFrame.new(0, 0.4, 5)
    spawn.Color = COLORS.blue
    spawn.Material = Enum.Material.Neon
    spawn.Transparency = 0.25
    spawn.Anchored = true
    spawn.Neutral = true
    spawn.Duration = 0
    spawn.Parent = root

    local stations = {}
    local specs = {
        { id = "Bank", name = "CASHCOMPASS BANK", subtitle = "Balance / payday / savings", x = -30, z = -28, angle = 0, color = Color3.fromRGB(83, 181, 237) },
        { id = "Store", name = "THE CORNER STORE", subtitle = "Wants, needs, and tradeoffs", x = 30, z = -28, angle = 0, color = Color3.fromRGB(87, 210, 179) },
        { id = "Apartment", name = "YOUR APARTMENT", subtitle = "Rent comes before payday", x = -30, z = 28, angle = math.pi, color = Color3.fromRGB(151, 166, 219) },
        { id = "Advisor", name = "FUTURE YOU TERMINAL", subtitle = "Forecast / repairs / results", x = 30, z = 28, angle = math.pi, color = Color3.fromRGB(242, 194, 105) },
    }
    for _, spec in specs do
        local building = Instance.new("Model")
        building.Name = spec.id
        building.Parent = root
        local origin = CFrame.new(spec.x, 0, spec.z) * CFrame.Angles(0, spec.angle, 0)
        local function block(name, size, offset, color, material)
            return part(building, name, size, origin * CFrame.new(offset), color, material)
        end
        block("Foundation", Vector3.new(25, 0.5, 21), Vector3.new(0, 0.25, 0), COLORS.cream)
        block("Building", Vector3.new(21, 10, 14), Vector3.new(0, 5.5, -2), COLORS.cream, Enum.Material.Concrete)
        block("Roof", Vector3.new(23, 1, 16), Vector3.new(0, 11, -2), spec.color)
        block("Door", Vector3.new(4, 7, 0.3), Vector3.new(0, 4, 5.2), COLORS.navy)
        for _, x in {-7, 7} do
            block("Window", Vector3.new(4, 4, 0.35), Vector3.new(x, 6, 5.3), spec.color, Enum.Material.Glass)
        end
        block("Awning", Vector3.new(21, 0.7, 4), Vector3.new(0, 8, 7), spec.color)
        local kiosk = block("Interact", Vector3.new(3, 2.5, 2), Vector3.new(0, 1.75, 10), COLORS.navy)
        block("TerminalScreen", Vector3.new(2.4, 1.6, 0.2), Vector3.new(0, 2.25, 11.1), spec.color, Enum.Material.Neon)
        sign(kiosk, spec.name, spec.subtitle, spec.color)
        local prompt = Instance.new("ProximityPrompt")
        prompt.Name = "VisitStation"
        prompt.ActionText = "Explore"
        prompt.ObjectText = spec.id
        prompt.KeyboardKeyCode = Enum.KeyCode.E
        prompt.GamepadKeyCode = Enum.KeyCode.ButtonX
        prompt.HoldDuration = 0
        prompt.MaxActivationDistance = 12
        prompt.RequiresLineOfSight = false
        prompt.Parent = kiosk
        stations[spec.id] = kiosk
        -- A friendly original block NPC next to every terminal.
        block("GuideBody", Vector3.new(2, 2.5, 1), Vector3.new(6, 2.4, 10), spec.color)
        local head = block("GuideHead", Vector3.new(1.6, 1.6, 1.6), Vector3.new(6, 4.4, 10), Color3.fromRGB(247, 215, 176))
        head.Shape = Enum.PartType.Ball
        for _, x in {5.45, 6.55} do
            block("GuideLeg", Vector3.new(0.8, 1.4, 0.8), Vector3.new(x, 0.9, 10), COLORS.navy)
        end
        for _, x in {5.7, 6.3} do
            block("GuideEye", Vector3.new(0.12, 0.16, 0.1), Vector3.new(x, 4.5, 10.78), COLORS.navy)
        end
    end
    for _, position in {Vector3.new(-46, 0, -42), Vector3.new(46, 0, -42), Vector3.new(-46, 0, 42), Vector3.new(46, 0, 42)} do
        part(root, "TreeTrunk", Vector3.new(1.4, 5, 1.4), CFrame.new(position + Vector3.new(0, 2.5, 0)), Color3.fromRGB(123, 91, 65), Enum.Material.Wood)
        local canopy = part(root, "TreeCanopy", Vector3.new(8, 8, 8), CFrame.new(position + Vector3.new(0, 7, 0)), COLORS.teal)
        canopy.Shape = Enum.PartType.Ball
    end
    return { stations = stations, spawnCFrame = CFrame.new(0, 4, 5) }
end

return World
