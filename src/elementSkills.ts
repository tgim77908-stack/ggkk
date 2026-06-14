/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ElementId, ElementInfo, FusionSkill } from './types';

export const ELEMENTS_LIST: ElementInfo[] = [
  {
    id: 'fire',
    name: '화염 (Fire)',
    emoji: '🔥',
    color: '#ef4444',
    gradient: 'from-orange-600 to-red-600',
    skills: {
      s1: { name: '파이어 볼', desc: '투사체를 날려 적중 시 폭발 및 3초간 지속 화상 대미지', key: 'A' },
      s2: { name: '화염 장벽', desc: '내 자리에 화염 지대를 소형으로 깔아 지속 피해 유도', key: 'S' }
    }
  },
  {
    id: 'lightning',
    name: '번개 (Lightning)',
    emoji: '⚡',
    color: '#eab308',
    gradient: 'from-yellow-400 to-amber-500',
    skills: {
      s1: { name: '뇌신화', desc: '원하는 위치로 즉시 순간이동 및 주변 적 짧은 경직', key: 'A' },
      s2: { name: '방전 스파크', desc: '주변 넓은 영역에 순간 벼락 피해 장전', key: 'S' }
    }
  },
  {
    id: 'ice',
    name: '얼음 (Ice)',
    emoji: '❄️',
    color: '#06b6d4',
    gradient: 'from-sky-400 to-cyan-500',
    skills: {
      s1: { name: 'PROZON 버스트', desc: '내 주변 한기 방출, 접근한 적 이동 속도 50% 감소', key: 'A' },
      s2: { name: '고드름 미사일', desc: '전방에 얼음 바늘 세 개를 난사', key: 'S' }
    }
  },
  {
    id: 'plant',
    name: '식물 (Plant)',
    emoji: '🌿',
    color: '#22c55e',
    gradient: 'from-emerald-500 to-green-600',
    skills: {
      s1: { name: '가시 덫', desc: '바닥에 덫 설치, 밟은 적 1.5초간 이동 불가 속박', key: 'A' },
      s2: { name: '치유의 꽃', desc: '나에게 가벼운 회복 시드 부여 (체력 15 회복)', key: 'S' }
    }
  },
  {
    id: 'wind',
    name: '바람 (Wind)',
    emoji: '🌪️',
    color: '#94a3b8',
    gradient: 'from-slate-300 to-slate-500',
    skills: {
      s1: { name: '윈드 블래스트', desc: '강력한 돌풍으로 다가오는 적을 화면 끝으로 넉백', key: 'A' },
      s2: { name: '돌풍 비행', desc: '위로 바람을 일으켜 높이 하이점프 시전', key: 'S' }
    }
  },
  {
    id: 'light',
    name: '빛 (Light)',
    emoji: '🌟',
    color: '#fef08a',
    gradient: 'from-yellow-200 to-amber-300',
    skills: {
      s1: { name: '레이저 빔', desc: '즉시 맵 끝까지 도달하는 직선형 광선 발사', key: 'A' },
      s2: { name: '태양의 가호', desc: '즉각 실드를 얻고 넉백 보정', key: 'S' }
    }
  },
  {
    id: 'earth',
    name: '대지 (Earth)',
    emoji: '⛰️',
    color: '#b45309',
    gradient: 'from-amber-700 to-amber-900',
    skills: {
      s1: { name: '스톤 아머', desc: '바위 보호막 생성, 유지 동안 피격 시 밀려나지 않음(슈퍼아머)', key: 'A' },
      s2: { name: '바위 폭격', desc: '적 머리 위에 커다란 바위 낙하 및 경직 부여', key: 'S' }
    }
  },
  {
    id: 'void',
    name: '어둠 (Void)',
    emoji: '🌙',
    color: '#a855f7',
    gradient: 'from-purple-600 to-violet-900',
    skills: {
      s1: { name: '블랙홀', desc: '암흑 구체를 던져 주변의 적을 중심부로 강하게 끌어당김', key: 'A' },
      s2: { name: '어둠의 흡수', desc: '적의 기력을 강타해 피해의 일부를 마나로 회환', key: 'S' }
    }
  }
];

export const ELEMENTS_MAP = ELEMENTS_LIST.reduce((acc, current) => {
  acc[current.id] = current;
  return acc;
}, {} as Record<ElementId, ElementInfo>);

export function getFusionKey(elem1: ElementId, elem2: ElementId): string {
  return [elem1, elem2].sort().join('+');
}

export const FUSION_SKILLS_LIST: Record<string, FusionSkill> = {
  // Fire combinations (7 elements)
  [getFusionKey('fire', 'lightning')]: {
    name: '플라즈마 가이아 버스트 (Plasma Gaia Burst)',
    desc: '초고온의 플라즈마 빔을 전방으로 발사하여 맵 전체에 광역 폭발 피해를 주고 즉시 [화상]과 [감전]을 동시 부여합니다.',
    effect: '화상 + 감전 유도 & 초거대 레이저 광역 광선',
    color: '#f97316',
    animationType: 'plasma_beam'
  },
  [getFusionKey('fire', 'ice')]: {
    name: '열반의 증기 폭발 (Steam Explosion)',
    desc: '극과 극의 원소가 만나 맵 전체에 치명적인 고압 증기를 품어냅니다. 적의 방어력을 50% 무시하는 고정 피해를 입힙니다.',
    effect: '방어 관통 50% 고정 대미지 & 맵 전반 하얀 고압 증기 연출',
    color: '#e2e8f0',
    animationType: 'steam_blast'
  },
  [getFusionKey('fire', 'wind')]: {
    name: '멸화의 토네이도 (Hellfire Typhoon)',
    desc: '거대한 화염 회오리가 전진하며 적을 에어본 시키고, 공중에 머무는 동안 지속적인 화상 피해를 줍니다.',
    effect: '에어본 + 다단히트 지속 메가 화염 토네이도',
    color: '#f43f5e',
    animationType: 'hellfire_cyclone'
  },
  [getFusionKey('fire', 'earth')]: {
    name: '용암 분출 (Volcanic Eruption)',
    desc: '바닥을 내리쳐 용암 지대를 만듭니다. 적에게 강한 대미지와 넉백을 주며, 바닥에 남은 용암지대는 5초간 초당 치명적인 화상 피해를 입힙니다.',
    effect: '강력 대미지 + 넉백 + 5초간 바닥 침식 데드 존 생성',
    color: '#ea580c',
    animationType: 'volcano'
  },
  [getFusionKey('fire', 'light')]: {
    name: '태양 플레어 (Solar Flare)',
    desc: '태양의 고리 형상을 소환하여 화면 전체를 강타합니다. 폭발적인 피해와 함께 적을 2.5초간 [실명] 상태로 만듭니다.',
    effect: '대형 폭발 대미지 + 적 브라우저 화면 백화 패닉화 (빛 장막)',
    color: '#facc15',
    animationType: 'solar_flare'
  },
  [getFusionKey('fire', 'void')]: {
    name: '연옥의 불꽃 (Abyss Inferno)',
    desc: '꺼지지 않는 검은 불꽃을 발사합니다. 적에게 피해를 줌과 동시에, 적이 스킬을 사용할 때마다 역으로 대미지를 입는 [저주] 상태이상을 부여합니다.',
    effect: '강공 + 스킬 반동 저주 상태 유도러 생성',
    color: '#dc2626',
    animationType: 'abyss_inferno'
  },
  [getFusionKey('fire', 'plant')]: {
    name: '들불의 번식 (Wildfire Sprout)',
    desc: '적의 발밑에 불타는 나무 덩굴을 소환합니다. 적을 1.5초간 묶어두며, 묶여있는 동안 화상 대미지가 매초 2배씩 증가합니다.',
    effect: '1.5초 발목 속박 + 기하급수적 화상 도트 누적',
    color: '#854d0e',
    animationType: 'wildfire_sprout'
  },

  // Ice combinations (6 remaining)
  [getFusionKey('ice', 'lightning')]: {
    name: '초전도 동결 (Superconducting Blizzard)',
    desc: '냉기와 번개가 결합한 고리 모양의 파동을 방출합니다. 적을 즉시 1.5초간 얼림과 동시에, 빙결이 풀리는 순간 기절(Stun)을 연계합니다.',
    effect: '강제 빙결 1.5초 + 해제 시 추가 기절 1.5초 유도 연쇄 락다운',
    color: '#38bdf8',
    animationType: 'superconduct'
  },
  [getFusionKey('ice', 'wind')]: {
    name: '절대영도 블리자드 (Absolute Zero)',
    desc: '내 주변에 강력한 칼바람과 한기를 뿜어냅니다. 접근하는 적은 화면 끝으로 밀려나며 4초간 이동 속도가 80% 감소합니다.',
    effect: '화면 외곽 강제 넉백 + 슬로우 80%',
    color: '#a5f3fc',
    animationType: 'absolute_zero'
  },
  [getFusionKey('ice', 'earth')]: {
    name: '빙결 수정 요새 (Glacier Fortress)',
    desc: '온몸을 단단한 얼음 바위로 감싸며 자신에게 거대한 보호막을 부여합니다. 버프 지속 시간 동안 피격 시 적을 느려지게 만들고 자신은 [슈퍼아머] 상태가 됩니다.',
    effect: '60 실드 충격 흡수 + 슈퍼아머 + 타격 반격 침강 둔화 효과',
    color: '#0ea5e9',
    animationType: 'glacier_fortress'
  },
  [getFusionKey('ice', 'light')]: {
    name: '영하의 프리즘 (Frozen Prism)',
    desc: '적 주변에 얼음 거울들을 생성한 뒤 빛을 반사시켜 난반사 레이저 공격을 가합니다. 다단히트 피해를 주며 적의 공격 속도를 4초간 50% 감소시킵니다.',
    effect: '거울 연출 레이저 난사 다단히트 + 공격 속도 50% 격하',
    color: '#e0f2fe',
    animationType: 'frozen_prism'
  },
  [getFusionKey('ice', 'void')]: {
    name: '심연의 서리 (Abyssal Frost)',
    desc: '서늘한 어둠의 기운으로 적의 발을 얼려 바닥에 고정합니다. 적의 기력(마나) 스태미나를 0으로 만들고, 3초간 마나 회복을 봉쇄합니다.',
    effect: '마나 0 소모 강탈 + 3초간 MP 회복 올인 차폐 봉쇄',
    color: '#4f46e5',
    animationType: 'abyssal_frost'
  },
  [getFusionKey('ice', 'plant')]: {
    name: '만년서리 가시 감옥 (Frost Prison)',
    desc: '지면에서 얼어붙은 거대한 가시 덩굴이 솟구쳐 적을 추적합니다. 적중당한 적은 거대한 얼음 수정에 갇히며 3초간 [완전 빙결] 상태가 됩니다.',
    effect: '유도 가시 돌출 + 3초 강제 행동 마비 동결 감금',
    color: '#0891b2',
    animationType: 'frost_prison'
  },

  // Lightning combinations (5 remaining)
  [getFusionKey('lightning', 'wind')]: {
    name: '뇌우의 폭풍 (Thunderstorm Drive)',
    desc: '번개를 머금은 폭풍이 되어 번개 속도로 화면 전체를 무작위로 종횡무진하며 적을 관통 타격합니다. 시전 중 유저는 완전 무적 상태가 됩니다.',
    effect: '번쩍이는 전격 도끼 돌진 빔 + 채널링 전탄 무적 참격',
    color: '#fef08a',
    animationType: 'thunderstorm_drive'
  },
  [getFusionKey('lightning', 'earth')]: {
    name: '지반 과전류 (Earth Grounding)',
    desc: '지면으로 고압의 전류를 흘려보내 대지를 붕괴시킵니다. 화면 지상에 있는 모든 적을 에어본 시키고 2초간 [마비(기절)] 시킵니다.',
    effect: '지면 충격 플래시 + 전장 전원 공중 진동 + 2초 하드 스턴',
    color: '#d97706',
    animationType: 'earth_grounding'
  },
  [getFusionKey('lightning', 'light')]: {
    name: '기가 볼트 래피드 (Hyper Speed Light)',
    desc: '빛과 번개의 속도로 적의 뒤로 순간이동하여 참격을 날립니다. 회피가 불가능할 정도의 발동 속도를 자랑하는 초고속 저격 스킬입니다.',
    effect: '텔포 습격 + 고속 스윕 직선 연쇄 참격',
    color: '#fbbf24',
    animationType: 'hyper_speed_light'
  },
  [getFusionKey('lightning', 'void')]: {
    name: '암흑 점멸 (Void Blink)',
    desc: '화면에서 사라진 뒤 암전 효과와 함께 적의 머리 위에서 거대한 검은 낙뢰를 떨어뜨립니다. 적의 모든 버프를 해제하며 큰 대미지를 줍니다.',
    effect: '모든 버프 완전 강제 해제(디스펠) + 대형 검은 암뢰 직격',
    color: '#6b21a8',
    animationType: 'void_blink'
  },
  [getFusionKey('lightning', 'plant')]: {
    name: '바이오 일렉트릭 (Bio-Electricity)',
    desc: '생체 전류를 증폭시키는 덩굴을 소환해 적을 감쌉니다. 적이 움직이거나 스킬을 쓸 때마다 감전 스파크가 일어나 주변에 방사형 피해를 줍니다.',
    effect: '움직임/스킬 트리거 시 주위에 연속 낙사 스패닝 대미지 환원',
    color: '#15803d',
    animationType: 'bio_electricity'
  },

  // Wind combinations (4 remaining)
  [getFusionKey('wind', 'earth')]: {
    name: '모래폭풍 (Sandstorm Hazard)',
    desc: '화면에 거대한 모래폭풍 영역을 생성합니다. 영역 내의 적은 지속 피해를 입고 투사체 스킬이 증발하며, 이동 방향이 무작위로 뒤틀립니다.',
    effect: '투사체 증발 구역 형성 + 키 인풋 역방향 혼란',
    color: '#ca8a04',
    animationType: 'sandstorm_hazard'
  },
  [getFusionKey('wind', 'light')]: {
    name: '신기루: 섬광 폭풍 대시 (Mirage Rush)',
    desc: '빛의 속도로 바람을 가르며 돌진 난무를 펼칩니다. 경로에 있던 적들은 큰 대미지를 입음과 동시에 2초간 화면이 하얗게 변하는 [실명] 상태에 빠집니다.',
    effect: '빛 돌진 궤도 폭발 + 2초간 화면 완전 블라인드 페이딩',
    color: '#fef9c3',
    animationType: 'mirage_rush'
  },
  [getFusionKey('wind', 'void')]: {
    name: '공허의 진공 (Void Vacuum)',
    desc: '중심부로 모든 것을 소멸시키는 진공 블랙홀을 생성합니다. 맵 안의 모든 오브젝트와 적을 중심으로 매우 강하게 끌어당기며 압착 피해를 줍니다.',
    effect: '초강력 장기간 중심지 빨아드림 자석력 + 대량 소산 분쇄 딜',
    color: '#581c87',
    animationType: 'void_vacuum'
  },
  [getFusionKey('wind', 'plant')]: {
    name: '칼날 낙엽 (Razor Leaf Hurricane)',
    desc: '날카로운 식물 잎사귀가 섞인 돌풍을 전방으로 발사합니다. 수십 번의 다단히트 가위질 피해를 주며 적을 뒤로 강하게 밀쳐냅니다.',
    effect: '전방 다각도 고속 잎날 다단 관통 발사 + 광풍 넉백',
    color: '#16a34a',
    animationType: 'razor_leaf'
  },

  // Earth combinations (3 remaining)
  [getFusionKey('earth', 'light')]: {
    name: '성석의 잔영 (Sacred Prism Wall)',
    desc: '빛나는 거대한 보석 벽을 땅에서 솟구치게 합니다. 벽이 생성될 때 적을 압착하여 피해를 주고, 빛이 뿜어져 나와 적을 1.5초간 기절시킵니다.',
    effect: '장벽 형성 충각 대미지 + 눈부신 발산 빛으로 1.5초 기절',
    color: '#fbbf24',
    animationType: 'sacred_prism'
  },
  [getFusionKey('earth', 'void')]: {
    name: '네더월드: 중력 붕괴 (Gravitational Collapse)',
    desc: '주변 공간을 암흑으로 물들이며 초고중력장을 형성합니다. 범위 내 모든 적을 강제로 다운시키고 2초간 이동 봉쇄 및 방어력을 50% 감소시킵니다.',
    effect: '강제 다운 + 3초간 이동 완전 정지 + 방어력 50% 격하',
    color: '#3b0764',
    animationType: 'gravitational_collapse'
  },
  [getFusionKey('earth', 'plant')]: {
    name: '세계수의 뿌리 (Root of Yggdrasil)',
    desc: '지면 전체에서 거대한 나무뿌리들이 솟구쳐 적을 짓누릅니다. 큰 대미지와 함께 나의 최대 체력의 30%만큼을 즉시 회복하는 생존형 궁극기입니다.',
    effect: '거대 뿌리 일격 + 본인 최대 체력 30% 즉각 힐링 수혈',
    color: '#1e3a8a',
    animationType: 'root_yggdrasil'
  },

  // Remaining (3 remaining)
  [getFusionKey('light', 'void')]: {
    name: '황혼의 종말 (Twilight Eclipse)',
    desc: '빛과 어둠이 공존하는 구체를 생성하여 전장을 폭발시킵니다. 적에게 가한 대미지의 50%만큼 내 체력을 흡수(Lifesteal)하고 적을 2초간 침묵 상태로 만듭니다.',
    effect: '격폭 피해 + 딜량의 50% 피 흡수 + 2초간 상대 스킬 일체 발동 불가',
    color: '#701a75',
    animationType: 'twilight_eclipse'
  },
  [getFusionKey('light', 'plant')]: {
    name: '광합성 오버로드 (Photosynthesis Overdrive)',
    desc: '하늘에서 찬란한 빛의 기둥이 내려와 식물을 급성장시킵니다. 화면 전체의 적에게 피해를 주고, 자신은 5초간 모든 스킬 쿨타임이 200% 빠르게 회복되는 각성 상태가 됩니다.',
    effect: '폭설 필드 생성 + 5초간 스킬 대기 시간 3배속 가속 장전 버프',
    color: '#22c55e',
    animationType: 'photosynthesis'
  },
  [getFusionKey('void', 'plant')]: {
    name: '심연의 포자 (Abyssal Spore)',
    desc: '검은색 독 포자 무리를 전방에 뿌립니다. 포자에 닿은 적은 5초간 치명적인 [맹독]에 걸리며, 이동 속도가 시간이 지날수록 점점 더 느려집니다.',
    effect: '치명적 맹독 마진 딜링 + 점진 가중형 도트 슬로우 (최대 90% 감속)',
    color: '#581c87',
    animationType: 'abyssal_spore'
  }
};

export function getFusionSkill(elem1: ElementId, elem2: ElementId): FusionSkill {
  const key = getFusionKey(elem1, elem2);
  const skill = FUSION_SKILLS_LIST[key];
  if (!skill) {
    return {
      name: '원소 폭발 (Elemental Burst)',
      desc: '선택한 융합 원소들의 폭발적인 상호작용으로 강한 대미지를 입힙니다.',
      effect: '원소 충돌 피해',
      color: '#ffffff',
      animationType: 'basic_burst'
    };
  }
  return skill;
}
