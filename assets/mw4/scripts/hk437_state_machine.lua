-- HK437 预置状态机。
--
-- 该脚本当前不绑定任何武器 display，只提前定义弹匣视觉状态：
--   · 可见弹体：j_ammo_03 .. j_ammo_06
--   · 托弹板：mag_follower / 各扩容弹匣对应的 follower 组
--
-- 动画片段命名：
--   hk437_ammo_l{level}_{count}
--   level = 0..1（标准、二级扩容）
--   count = 00..04（可见弹体数量）
--
-- 每个片段应同时负责：
--   1. 当前弹匣等级的模型显隐；
--   2. j_ammo_XX 的显隐；
--   3. follower 的 Y 位移。弹量减少时 follower 上移；
--      弹量增加时 follower 下移，位置始终对应最下方仍可见的弹体。

local default = require("mw4_default_state_machine")

local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local static_track_top = default.static_track_top
local main_track_states = default.main_track_states

local function increment(obj)
    obj.value = obj.value + 1
    return obj.value - 1
end

-- 放在默认静态轨道之后，避免覆盖 static_idle、快慢机或 bolt_caught。
local HK437_AMMO_TRACK = increment(static_track_top)
local HK437_SIGHT_TRACK = increment(static_track_top)
local HK437_FIRE_MODE_TRACK = increment(static_track_top)
local HK437_SWITCH_MODE_TRACK = increment(static_track_top)

local VISIBLE_ROUNDS = 4
-- 用户 2026-11-01 指定：HK437 禁用三级扩容与弹鼓配件。
-- TACZ 的 level=2/3 都回落到二级扩容视觉，不允许进入三级弹鼓状态。
local MAX_MAG_LEVEL = 1
local CLIP_PREFIX = "hk437_ammo_l"
local CAPACITY_BY_LEVEL = {30, 45, 60}
local MELEE_ANIMATION_COUNT = 3

local function nextMeleeIndex(this)
    if this.hk437_melee_bag == nil or #this.hk437_melee_bag == 0 then
        this.hk437_melee_bag = {}
        for index = 1, MELEE_ANIMATION_COUNT do
            table.insert(this.hk437_melee_bag, index)
        end
        for index = #this.hk437_melee_bag, 2, -1 do
            local swap = math.random(index)
            this.hk437_melee_bag[index], this.hk437_melee_bag[swap] =
                this.hk437_melee_bag[swap], this.hk437_melee_bag[index]
        end
        if this.hk437_last_melee == this.hk437_melee_bag[#this.hk437_melee_bag] then
            this.hk437_melee_bag[#this.hk437_melee_bag], this.hk437_melee_bag[1] =
                this.hk437_melee_bag[1], this.hk437_melee_bag[#this.hk437_melee_bag]
        end
    end
    local index = table.remove(this.hk437_melee_bag)
    this.hk437_last_melee = index
    return index
end

local function safeContextNumber(context, method, fallback)
    local ok, value = pcall(function()
        return context[method](context)
    end)
    if ok and value ~= nil then
        return value
    end
    return fallback
end

local function getMagLevel(context)
    local level = safeContextNumber(context, "getMagExtentLevel", 0)
    return math.max(0, math.min(MAX_MAG_LEVEL, math.floor(level + 0.5)))
end

local function getVisibleRoundCount(context)
    local ammo = math.max(0, safeContextNumber(context, "getAmmoCount", 0))
    if ammo <= 0 then
        return 0
    end

    local level = getMagLevel(context)
    local capacity = safeContextNumber(
        context,
        "getMaxAmmoCount",
        CAPACITY_BY_LEVEL[level + 1] or math.max(ammo, VISIBLE_ROUNDS)
    )
    capacity = math.max(ammo, capacity, VISIBLE_ROUNDS)
    if capacity <= VISIBLE_ROUNDS then
        return math.min(VISIBLE_ROUNDS, ammo)
    end

    -- 模型只有 6 个独立弹体。30/45/50/60 发等容量按比例映射，
    -- 每次实际减弹都会在合适区间以内减少一颗可见弹体。
    return math.max(
        1,
        math.min(VISIBLE_ROUNDS, math.ceil(ammo * VISIBLE_ROUNDS / capacity))
    )
end

local function applyAmmoVisual(this, context, force)
    local level = getMagLevel(context)
    local count = getVisibleRoundCount(context)
    if (not force)
        and this.hk437_last_level == level
        and this.hk437_last_round_count == count then
        return
    end

    this.hk437_last_level = level
    this.hk437_last_round_count = count
    local clip = string.format(
        "%s%d_%02d",
        CLIP_PREFIX,
        level,
        count
    )
    context:runAnimation(
        clip,
        context:getTrack(STATIC_TRACK_LINE, this.HK437_AMMO_TRACK),
        false,
        PLAY_ONCE_HOLD,
        0
    )
end

local function hasScope(context)
    if context.getAttachment == nil then
        return false
    end
    local ok, attachment = pcall(function()
        return context:getAttachment("scope")
    end)
    return ok and attachment ~= nil and attachment ~= ""
end

local function applySightVisual(this, context, force)
    local visible = hasScope(context)
    if (not force) and this.hk437_last_sight_visible == visible then
        return
    end
    this.hk437_last_sight_visible = visible
    context:runAnimation(
        visible and "hk437_sight_on" or "hk437_sight_off",
        context:getTrack(STATIC_TRACK_LINE, this.HK437_SIGHT_TRACK),
        false,
        PLAY_ONCE_HOLD,
        0
    )
end

local base_track_state = setmetatable({}, {__index = default.base_track_state})

function base_track_state.entry(this, context)
    default.base_track_state.entry(this, context)
    applyAmmoVisual(this, context, true)
    applySightVisual(this, context, true)
end

function base_track_state.update(this, context)
    applyAmmoVisual(this, context, false)
    applySightVisual(this, context, false)
end

-- 三段近战动画随机洗牌；音效由动画自身的 sound_effects 固定绑定。
local idle_state = setmetatable({}, {__index = main_track_states.idle})

function idle_state.transition(this, context, input)
    if input == INPUT_BAYONET_MUZZLE or input == INPUT_BAYONET_STOCK then
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
    return main_track_states.idle.transition(this, context, input)
end

-- 快慢机静态姿态独立占一条轨道。所有普通动画都不能写
-- j_fire_select，否则动画开始/结束时会把这里的状态覆盖回零位。
local hk437_fire_mode_states = {
    semi = {},
    auto = {},
    draw = {}
}

function hk437_fire_mode_states.draw.update(this, context)
    context:trigger(this.INPUT_MODE_DRAW)
end

function hk437_fire_mode_states.draw.transition(this, context, input)
    if input ~= this.INPUT_MODE_DRAW then
        return nil
    end
    if context:getFireMode() == SEMI then
        context:runAnimation(
            "static_semi",
            context:getTrack(STATIC_TRACK_LINE, HK437_FIRE_MODE_TRACK),
            true,
            PLAY_ONCE_HOLD,
            0
        )
        return hk437_fire_mode_states.semi
    elseif context:getFireMode() == AUTO then
        context:runAnimation(
            "static_auto",
            context:getTrack(STATIC_TRACK_LINE, HK437_FIRE_MODE_TRACK),
            true,
            PLAY_ONCE_HOLD,
            0
        )
        return hk437_fire_mode_states.auto
    end
end

function hk437_fire_mode_states.semi.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HK437_FIRE_MODE_TRACK)
    if context:isHolding(track) then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
    end
    if context:getFireMode() == AUTO then
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
        if context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)) then
            context:trigger(this.INPUT_MODE_AUTO)
        end
    end
end

function hk437_fire_mode_states.semi.transition(this, context, input)
    if input == this.INPUT_MODE_AUTO then
        local switchTrack = context:getTrack(
            STATIC_TRACK_LINE,
            HK437_SWITCH_MODE_TRACK
        )
        if not context:isStopped(switchTrack) then
            return nil
        end
        context:runAnimation("switch_auto", switchTrack, false, PLAY_ONCE_STOP, 0)
        return hk437_fire_mode_states.auto
    end
    if input == INPUT_SHOOT or input == INPUT_RELOAD or input == INPUT_INSPECT then
        context:stopAnimation(context:getTrack(
            STATIC_TRACK_LINE,
            HK437_SWITCH_MODE_TRACK
        ))
    end
end

function hk437_fire_mode_states.auto.update(this, context)
    local track = context:getTrack(STATIC_TRACK_LINE, HK437_FIRE_MODE_TRACK)
    if context:isHolding(track) then
        context:runAnimation("static_auto", track, true, PLAY_ONCE_HOLD, 0)
    end
    if context:getFireMode() == SEMI then
        context:runAnimation("static_semi", track, true, PLAY_ONCE_HOLD, 0)
        if context:isStopped(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)) then
            context:trigger(this.INPUT_MODE_SEMI)
        end
    end
end

function hk437_fire_mode_states.auto.transition(this, context, input)
    if input == this.INPUT_MODE_SEMI then
        local switchTrack = context:getTrack(
            STATIC_TRACK_LINE,
            HK437_SWITCH_MODE_TRACK
        )
        if not context:isStopped(switchTrack) then
            return nil
        end
        context:runAnimation("switch_semi", switchTrack, false, PLAY_ONCE_STOP, 0)
        return hk437_fire_mode_states.semi
    end
    if input == INPUT_SHOOT or input == INPUT_RELOAD or input == INPUT_INSPECT then
        context:stopAnimation(context:getTrack(
            STATIC_TRACK_LINE,
            HK437_SWITCH_MODE_TRACK
        ))
    end
end

local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state
    }, {__index = main_track_states}),
    HK437_AMMO_TRACK = HK437_AMMO_TRACK,
    HK437_AMMO_CLIP_PREFIX = CLIP_PREFIX,
    HK437_SIGHT_TRACK = HK437_SIGHT_TRACK,
    HK437_FIRE_MODE_TRACK = HK437_FIRE_MODE_TRACK,
    HK437_SWITCH_MODE_TRACK = HK437_SWITCH_MODE_TRACK,
    INPUT_MODE_SEMI = "hk437_input_mode_semi",
    INPUT_MODE_AUTO = "hk437_input_mode_auto",
    INPUT_MODE_DRAW = "hk437_input_mode_draw",
    hk437_fire_mode_states = hk437_fire_mode_states,
    MAIN_TRACK = default.MAIN_TRACK,
    base_track_state = base_track_state
}, {__index = default})

function M:initialize(context)
    default.initialize(self, context)
    self.hk437_last_level = -1
    self.hk437_last_round_count = -1
    self.hk437_last_sight_visible = nil
    self.hk437_melee_bag = {}
    self.hk437_last_melee = -1
end

function M:states()
    return {
        self.base_track_state,
        self.bolt_caught_states.normal,
        self.over_heat_states.normal,
        self.main_track_states.start,
        self.gun_kick_state,
        self.movement_track_states.idle,
        self.ADS_states.normal,
        self.slide_states.normal,
        self.hk437_fire_mode_states.draw
    }
end

return M
