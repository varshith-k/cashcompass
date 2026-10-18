--!strict
-- Pure request authorization. Position/proximity is supplied by the server only.
local Protocol = {}

function Protocol.authorize(state: any, payload: any, atStation: boolean): (string?, string?)
    if type(payload) ~= "table" then return nil, "Invalid request." end
    if payload.action == "sync" then return "sync", nil end
    if payload.roundId ~= state.roundId or payload.revision ~= state.revision then
        return nil, "Your view was refreshed. Continue from the current objective."
    end
    if payload.action == "replay" then
        if not state.finished then return nil, "Finish this month before starting another." end
        return "replay", nil
    end
    if payload.action ~= "choose" or type(payload.choiceId) ~= "string" or #payload.choiceId > 32 then
        return nil, "Invalid choice request."
    end
    if state.finished then return nil, "This round is complete. Choose Play Again." end
    if not atStation then return nil, "Walk to your next station and use its Explore prompt first." end
    -- Extra client-supplied financial values are never consumed by the server.
    return "choose", nil
end

return Protocol
