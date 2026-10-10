import { describe, expect, it } from 'vitest';
import { forHoardings, plugForTheEnd, readPlugs, tickerLines, type Plug } from './plugs';

const plug = (kind: Plug['kind'], name: string, line = ''): Plug => ({
  kind,
  name,
  line,
  logo: null,
});

describe('readPlugs', () => {
  it('reads what the server sends, and leaves out whatever is not a plug', () => {
    const read = readPlugs({
      plugs: [
        {
          kind: 'sponsor',
          name: "Murphy's Hardware",
          line: 'Kill',
          logo: { large: 'data:a', small: 'data:b' },
        },
        { kind: 'event', name: ' Trad session ', line: 'Friday 9pm', logo: null },
        { kind: 'elephant', name: 'A kind it does not know', line: 7 },
        { name: '' },
        'not a plug',
        null,
      ],
    });

    expect(read).toEqual([
      {
        kind: 'sponsor',
        name: "Murphy's Hardware",
        line: 'Kill',
        logo: { large: 'data:a', small: 'data:b' },
      },
      { kind: 'event', name: 'Trad session', line: 'Friday 9pm', logo: null },
      { kind: 'offer', name: 'A kind it does not know', line: '', logo: null },
    ]);
  });

  it('has no plugs for an answer that is not one', () => {
    expect(readPlugs(null)).toEqual([]);
    expect(readPlugs({ plugs: 'none' })).toEqual([]);
    expect(readPlugs([])).toEqual([]);
  });
});

describe('forHoardings', () => {
  const all = [
    plug('event', 'Gig'),
    plug('sponsor', 'Murphy'),
    plug('offer', 'Food'),
    plug('sponsor', 'Kelly'),
  ];

  it('puts the sponsors first, in their order, then the rest', () => {
    expect(forHoardings(all, 4).map((each) => each.name)).toEqual([
      'Murphy',
      'Kelly',
      'Gig',
      'Food',
    ]);
  });

  it('goes round again when there are more hoardings than plugs, and stops short when fewer', () => {
    expect(forHoardings(all, 7).map((each) => each.name)).toEqual([
      'Murphy',
      'Kelly',
      'Gig',
      'Food',
      'Murphy',
      'Kelly',
      'Gig',
    ]);
    expect(forHoardings(all, 2).map((each) => each.name)).toEqual(['Murphy', 'Kelly']);
  });

  it('has no hoardings for no plugs', () => {
    expect(forHoardings([], 7)).toEqual([]);
    expect(forHoardings(all, 0)).toEqual([]);
  });
});

describe('tickerLines', () => {
  it('thanks a sponsor, names an event or an offer, and adds the line when there is one', () => {
    expect(
      tickerLines([
        plug('sponsor', "Murphy's Hardware"),
        plug('sponsor', 'Kelly Motors', 'Naas Road'),
        plug('event', 'Trad session', 'Friday 9pm'),
        plug('offer', 'Function room'),
      ]),
    ).toEqual([
      "THANKS TO MURPHY'S HARDWARE",
      'THANKS TO KELLY MOTORS  NAAS ROAD',
      'TRAD SESSION  FRIDAY 9PM',
      'FUNCTION ROOM',
    ]);
  });
});

describe('plugForTheEnd', () => {
  const all = [plug('sponsor', 'A'), plug('event', 'B'), plug('offer', 'C')];

  it('picks one by a number from 0 up to 1', () => {
    expect(plugForTheEnd(all, 0)?.name).toBe('A');
    expect(plugForTheEnd(all, 0.5)?.name).toBe('B');
    expect(plugForTheEnd(all, 0.99)?.name).toBe('C');
    expect(plugForTheEnd(all, 1)?.name).toBe('C');
  });

  it('has none to pick from no plugs', () => {
    expect(plugForTheEnd([], 0.5)).toBeNull();
  });
});
