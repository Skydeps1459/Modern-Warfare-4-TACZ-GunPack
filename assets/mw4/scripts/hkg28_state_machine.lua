-- HK G28 状态机
-- 2026-11-22 按官方枪包（tacz jar 内置 tacz_default_gun）lua 格式重写。
-- 关键修正：读扩容等级一律用官方口径 `context:getMagExtentLevel()` + `ext == 0/1/2` 精确对号
--   + else 兜底标准弹匣（官方 mcx_spear_lt_state_machine.lua 即此写法，跨版本行为稳定）。
--   废弃自创的 getNbtAccessor NBT 链直读与多路径 pcall 兜底——非官方写法正是
--   "正式包全动画回退默认"的头号嫌疑（transition 中途异常 ⇒ 状态机整体失效）。
-- 脚本位置 "{命名空间}:{路径}" ⇒ require 写成 "{命名空间}_{路径}"
-- 注意！require 取得的内容不应该被修改，应仅调用
local default = require("mw4_default_state_machine")
local STATIC_TRACK_LINE = default.STATIC_TRACK_LINE
local MAIN_TRACK = default.MAIN_TRACK
local main_track_states = default.main_track_states

local inspect_state = setmetatable({}, {__index = main_track_states.inspect})
local idle_state = setmetatable({}, {__index = main_track_states.idle})

-- 三段刺刀随机袋：一轮内不重复，且新一轮首个不与上轮末尾重复（同 HK437 / AK74M）
local MELEE_ANIMATION_COUNT = 3

local function nextMeleeIndex(this)
    if this.hkg28_melee_bag == nil or #this.hkg28_melee_bag == 0 then
        this.hkg28_melee_bag = {}
        for index = 1, MELEE_ANIMATION_COUNT do
            table.insert(this.hkg28_melee_bag, index)
        end
        -- Fisher-Yates 洗牌
        for index = #this.hkg28_melee_bag, 2, -1 do
            local swap = math.random(index)
            this.hkg28_melee_bag[index], this.hkg28_melee_bag[swap] =
                this.hkg28_melee_bag[swap], this.hkg28_melee_bag[index]
        end
        -- 取出端是**尾部**，故跨轮防重复检查尾部：与上轮末尾相同则头尾交换
        local bag = this.hkg28_melee_bag
        if #bag >= 2 and this.hkg28_last_melee == bag[#bag] then
            bag[#bag], bag[1] = bag[1], bag[#bag]
        end
    end
    local index = table.remove(this.hkg28_melee_bag)
    this.hkg28_last_melee = index
    return index
end

-- 检查当前是否还有弹药（官方口径：枪管与弹匣都没弹才算空仓）
local function isNoAmmo(context)
    return (not context:hasBulletInBarrel()) and (context:getAmmoCount() <= 0)
end

-- 开镜进度 > 0.5 视为 ADS 换弹（播放保持开镜姿态的 _ads 片段）
local function isAds(context)
    return context:getAimingProgress() > 0.5
end

-- 播放换弹动画（官方 MCX 口径读扩容等级 + 精确对号）
-- ext == 3：特殊弹药配件（FMJ/HP/I 占扩容槽、等级 3），网格与动画均按二级扩容兜底
local function runReloadAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    local ads = isAds(context)
    if (isNoAmmo(context)) then
        if (ext == 2 or ext == 3) then
            context:runAnimation(ads and "reload_empty_xmag2_ads" or "reload_empty_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            context:runAnimation(ads and "reload_xmag1_empty_ads" or "reload_xmag1_empty", track, false, PLAY_ONCE_STOP, 0.2)
        else
            -- ext == 0 或其它异常值 → 标准弹匣（官方 else 兜底）
            context:runAnimation(ads and "reload_empty_ads" or "reload_empty", track, false, PLAY_ONCE_STOP, 0.2)
        end
    else
        if (ext == 2 or ext == 3) then
            context:runAnimation(ads and "reload_tactical_xmag2_ads" or "reload_tactical_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
        elseif (ext == 1) then
            context:runAnimation(ads and "reload_tactical_xmag1_ads" or "reload_tactical_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
        else
            context:runAnimation(ads and "reload_tactical_ads" or "reload_tactical", track, false, PLAY_ONCE_STOP, 0.2)
        end
    end
end

-- 播放检视动画（空仓检视只有标准版；带弹检视按扩容等级分流；ext == 3 同二级扩容）
local function runInspectAnimation(context)
    local track = context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK)
    local ext = context:getMagExtentLevel()
    if (isNoAmmo(context)) then
        context:runAnimation("inspect_empty", track, false, PLAY_ONCE_STOP, 0.2)
    elseif (ext == 2 or ext == 3) then
        context:runAnimation("inspect_xmag2", track, false, PLAY_ONCE_STOP, 0.2)
    elseif (ext == 1) then
        context:runAnimation("inspect_xmag1", track, false, PLAY_ONCE_STOP, 0.2)
    else
        context:runAnimation("inspect", track, false, PLAY_ONCE_STOP, 0.2)
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
    -- 换弹：按弹药 / 开镜 / 扩容等级分流
    if (input == INPUT_RELOAD) then
        runReloadAnimation(context)
        return this.main_track_states.idle
    end
    -- 检视：扩容弹匣有自己的检视动作
    if (input == INPUT_INSPECT) then
        runInspectAnimation(context)
        return inspect_state
    end
    -- 收枪等其余输入交给默认状态机
    return main_track_states.idle.transition(this, context, input)
end

-- 检视态：检测到开火模式切换输入时直接停止动画并回到闲置态
function inspect_state.transition(this, context, input)
    if (input == INPUT_FIRE_SELECT) then
        context:stopAnimation(context:getTrack(STATIC_TRACK_LINE, MAIN_TRACK))
        return this.main_track_states.idle
    end
    return main_track_states.inspect.transition(this, context, input)
end

-- 用元表的方式继承默认状态机的属性
local M = setmetatable({
    main_track_states = setmetatable({
        idle = idle_state,
        inspect = inspect_state
    }, {__index = main_track_states}),
    ADS_states = setmetatable({}, {__index = default.ADS_states}),
}, {__index = default})

function M:initialize(context)
    default.initialize(self, context)
    self.hkg28_melee_bag = {}
    self.hkg28_last_melee = -1
end

function M:states()
    -- 与默认状态机的状态列表保持一致（本枪不做 fire_mode 轨道）
    return {
        self.base_track_state,
        self.bolt_caught_states.normal,
        self.over_heat_states.normal,
        self.main_track_states.start,
        self.gun_kick_state,
        self.movement_track_states.idle,
        self.ADS_states.normal,
        self.slide_states.normal
    }
end

return M
