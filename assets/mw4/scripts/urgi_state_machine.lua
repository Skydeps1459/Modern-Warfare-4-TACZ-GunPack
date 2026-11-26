-- URGI 状态机（基于包内默认状态机扩展）
-- 脚本位置 "{命名空间}:{路径}" ⇒ require 写成 "{命名空间}_{路径}"
-- 换弹/检视一律用官方口径 `context:getMagExtentLevel()` + `ext == 0/1/2/3` 精确对号
--   + else 兜底标准弹匣（官方 mk18_state_machine.lua 即此写法）。
-- 本枪四档动画齐全（xmag1/xmag2/xmag3 各一套），不需要跨档兜底。
local default = require("mw4_default_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states
local static_track_top = default.static_track_top

local inspect_state = setmetatable({}, {__index = main_track_states.inspect})
local idle_state = setmetatable({}, {__index = main_track_states.idle})

-- 相当于 obj.value++
local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

local FIRE_MODE_TRACK = increment(static_track_top)
local SWITCH_MODE_TRACK = increment(static_track_top)

-- 三段刺刀随机袋：一轮内不重复，且新一轮首个不与上轮末尾重复（同 HK437 / AK74M / G28）
local MELEE_ANIMATION_COUNT = 3

local function nextMeleeIndex(this)
    if this.urgi_melee_bag == nil or #this.urgi_melee_bag == 0 then
        this.urgi_melee_bag = {}
        for index = 1, MELEE_ANIMATION_COUNT do
            table.insert(this.urgi_melee_bag, index)
        end
        -- Fisher-Yates 洗牌
        for index = #this.urgi_melee_bag, 2, -1 do
            local swap = math.random(index)
            this.urgi_melee_bag[index], this.urgi_melee_bag[swap] =
                this.urgi_melee_bag[swap], this.urgi_melee_bag[index]
        end
        -- 取出端是**尾部**，故跨轮防重复检查尾部
        local bag = this.urgi_melee_bag
        if #bag >= 2 and this.urgi_last_melee == bag[#bag] then
            bag[#bag], bag[1] = bag[1], bag[#bag]
        end
    end
    local index = table.remove(this.urgi_melee_bag)
    this.urgi_last_melee = index
    return index
end

-- 检查当前是否还有弹药（官方口径：枪管与弹匣都没弹才算空仓）
local function isNoAmmo(context)
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

local function runReloadAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    if (isNoAmmo(context)) then
        if (ext == 3) then
            context:runAnimation("reload_empty_xmag3", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            context:runAnimation("reload_empty_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            context:runAnimation("reload_empty_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_empty", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        if (ext == 3) then
            context:runAnimation("reload_tactical_xmag3", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            context:runAnimation("reload_tactical_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            context:runAnimation("reload_tactical_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
        end
    end
end

local function runInspectAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    if (isNoAmmo(context)) then
        if (ext == 3) then
            context:runAnimation("inspect_empty_xmag3", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            context:runAnimation("inspect_empty_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            context:runAnimation("inspect_empty_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        if (ext == 3) then
            context:runAnimation("inspect_xmag3", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 2) then
            context:runAnimation("inspect_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            context:runAnimation("inspect_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
        end
    end
end

function idle_state.transition(this, context, input)
    -- 刺刀三段随机播放；音效由动画自身的 sound_effects 绑定
    if (input == INPUT_BAYONET_STOCK or input == INPUT_BAYONET_MUZZLE) then
        local index = nextMeleeIndex(this)
        context:runAnimation(
            "melee_bayonet_" .. tostring(index),
            context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK),
            false,
            PLAY_ONCE_STOP,
            0.2
        )
        return this.main_track_states.idle
    end
    if (input == INPUT_RELOAD) then
        runReloadAnimation(context)
        return this.main_track_states.idle
    end
    if (input == INPUT_PUT_AWAY) then
        local put_away_time = context:getPutAwayTime()
        local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
        -- 停下切换模式动画
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
        -- 空仓时改用 put_away_empty，收枪过程中也保持空仓姿态
        local putAwayAnimation = "put_away"
        if ((not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)) then
            putAwayAnimation = "put_away_empty"
        end
        context:runAnimation(putAwayAnimation, track, false, PLAY_ONCE_HOLD, put_away_time * 0.75)
        -- 设定动画进度为最后一帧，再向前拨动 put_away_time
        context:setAnimationProgress(track, 1, true)
        context:adjustAnimationProgress(track, -put_away_time, false)
        return this.main_track_states.final
    end
    if (input == INPUT_INSPECT) then
        runInspectAnimation(context)
        return inspect_state
    end
    return main_track_states.idle.transition(this, context, input)
end

-- 开火模式轨道：专门给快慢机动画服务
local fire_mode_state = {semi = {}, auto = {}, draw = {}}

function fire_mode_state.draw.update(this, context)
    context:trigger(this.INPUT_MODE_DRAW)
end

function fire_mode_state.draw.transition(this, context, input)
    if (input == this.INPUT_MODE_DRAW) then
        if (context:getFireMode() == SEMI) then
            context:runAnimation("static_semi", context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK), true, PLAY_ONCE_HOLD, 0)
            return fire_mode_state.semi
        elseif (context:getFireMode() == AUTO) then
            context:runAnimation("static_auto", context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK), true, PLAY_ONCE_HOLD, 0)
            return fire_mode_state.auto
        end
    end
end

function fire_mode_state.semi.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
    end
    if (context:getFireMode() == AUTO) then
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
        if (context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
            context:trigger(this.INPUT_MODE_AUTO)
        end
    end
end

function fire_mode_state.semi.transition(this, context, input)
    if (input == this.INPUT_MODE_AUTO) then
        local switchTrack = context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)
        -- 上一次拨杆动画（含音效）没播完就忽略这次切换，避免动画/音效叠加
        if (not context:isStopped(switchTrack)) then
            return nil
        end
        context:runAnimation("switch_auto", switchTrack, false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.auto
    end
    if (input == INPUT_SHOOT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if (input == INPUT_RELOAD) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if (input == INPUT_INSPECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end

function fire_mode_state.auto.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, FIRE_MODE_TRACK)
    if (context:isHolding(track)) then
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
    end
    if (context:getFireMode() == SEMI) then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
        if (context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))) then
            context:trigger(this.INPUT_MODE_SEMI)
        end
    end
end

function fire_mode_state.auto.transition(this, context, input)
    if (input == this.INPUT_MODE_SEMI) then
        local switchTrack = context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK)
        if (not context:isStopped(switchTrack)) then
            return nil
        end
        context:runAnimation("switch_semi", switchTrack, false, PLAY_ONCE_STOP, 0)
        return fire_mode_state.semi
    end
    if (input == INPUT_SHOOT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if (input == INPUT_RELOAD) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
    if (input == INPUT_INSPECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, SWITCH_MODE_TRACK))
    end
end

-- 快慢机立刻打断检视
function inspect_state.transition(this, context, input)
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end

local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        inspect = inspect_state
    }, {__index = main_track_states}),
    ADS_states = setmetatable({}, {__index = default.ADS_states}),
    FIRE_MODE_TRACK = FIRE_MODE_TRACK,
    SWITCH_MODE_TRACK = SWITCH_MODE_TRACK,
    INPUT_MODE_SEMI = "input_mode_semi",
    INPUT_MODE_AUTO = "input_mode_auto",
    INPUT_MODE_DRAW = "input_mode_draw",
    fire_mode_state = fire_mode_state
}, {__index = default})

function M:initialize(context)
    default.initialize(self, context)
    self.urgi_melee_bag = {}
    self.urgi_last_melee = -1
end

function M:states()
    return {
        self.base_track_state,
        self.bolt_caught_states.normal,
        self.main_track_states.start,
        self.gun_kick_state,
        self.movement_track_states.idle,
        self.ADS_states.normal,
        self.slide_states.normal,
        self.fire_mode_state.draw
    }
end

return M
