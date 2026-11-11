export const MODES = {
  ffa: {
    id: 'ffa',
    name: { zh: '大乱斗', en: 'FREE-FOR-ALL' },
    teams: 0,
    rounds: 3,
    players: 8,
    desc: { zh: '8 只动物，最后站着的人赢', en: 'Eight paws, one survivor' },
  },
  team: {
    id: 'team',
    name: { zh: '团队战', en: 'TEAM BRAWL' },
    teams: 2,
    teamSize: 4,
    rounds: 3,
    players: 8,
    winRounds: 2,
    desc: { zh: '4v4，队友免伤，先赢 2 回合', en: '4v4. No friendly fire. First to 2.' },
  },
};

export const TEAM_COLORS = ['#FF626F', '#52A8FF'];
export const TEAM_NAMES = [{ zh: '红队', en: 'RED' }, { zh: '蓝队', en: 'BLUE' }];
