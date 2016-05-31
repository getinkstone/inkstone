// Timing is a model class that maintains the user's state for their current
// Inkstone session and supports queries like:
//  - How many flash cards are left in this session?
//  - What is the next flash card?
import {Model} from './model';
import {Settings} from './settings';
import {Vocabulary} from './vocabulary';

// Timing state tier 1: a Ground collection storing a single record with raw
// counts for usage in this session and a timestamp of when the session began.

const kSessionDuration = 20 * 60 * 60;

const mCounts = Model.collection('counts');

const newCounts = (ts) => ({adds: 0, failures: 0, reviews: 0, ts: ts});

const updateTimestamp = () => {
  const now = Model.timestamp();
  const counts = mCounts.findOne() || {ts: -Infinity};
  const wait = counts.ts + kSessionDuration - now;
  if (wait > 0) {
    time_left.set(wait);
  } else {
    mCounts.upsert({}, newCounts(now));
    time_left.set(kSessionDuration);
  }
  requestAnimationFrame(updateTimestamp);
}

Model.startup(updateTimestamp);

// Timing state tier 2: reactive variables built on top of the session counts
// that track what the next card is and how many cards of different classes
// are left in this session.

const maxes = new ReactiveVar();
const next_card = new ReactiveVar();
const remainder = new ReactiveVar();
const time_left = new ReactiveVar();

const draw = (deck, ts) => {
  let count = 0;
  let result = null;
  getters[deck](ts).forEach((card) => {
    if (!result || (card.next || 0) < result.next) {
      count = 1;
      result = card;
    } else if (card.next === result.next) {
      count += 1;
      if (count * Math.random() < 1) {
        result = card;
      }
    }
  });
  if (!result) {
    throw new Error(`Drew from empty deck: ${deck}`);
  }
  return {data: result, deck: deck};
}

const getters = {
  adds: (ts) => Vocabulary.getNewItems(),
  failures: (ts) => Vocabulary.getFailuresInRange(ts, ts + kSessionDuration),
  reviews: (ts) => Vocabulary.getItemsDueBy(ts, ts),
};

const mapDict = (dict, callback) => {
  const result = {};
  for (key in dict) {
    result[key] = callback(key, dict[key]);
  }
  return result;
}

const shuffle = () => {
  const counts = mCounts.findOne();
  const left = remainder.get();
  if (!counts || !left) return;

  let next = null;
  if (left.adds + left.reviews > 0) {
    const index = Math.random() * (left.adds + left.reviews);
    const deck = index < left.adds ? 'adds' : 'reviews';
    next = draw(deck, counts.ts);
  } else if (left.failures > 0) {
    next = draw('failures', counts.ts);
  }

  if (!next) {
    // TODO(skishore): Implement adding extra cards.
    let error = "You're done for the day!";
    next = {data: {error: error, type: 'error'}, deck: 'errors'};
  }

  next_card.set(next);
}

Model.autorun(() => {
  const value = mapDict(getters, (k, v) => Settings.get(`settings.max_${k}`));
  value.failures = Settings.get('settings.revisit_failures') ? Infinity : 0;
  maxes.set(value);
});

Model.autorun(() => {
  const counts = mCounts.findOne();
  if (!counts || !maxes.get()) return;
  remainder.set(mapDict(getters, (k, v) => {
    const limit = maxes.get()[k] - counts[k];
    if (limit <= 0) return limit;
    const cursor = v(counts.ts);
    cursor.limit = limit;
    return Math.min(cursor.count(), limit);
  }));
});

Model.autorun(shuffle);

// Timing interface: reactive getters for next_card and remainder.

const make = (k, v) => { const x = {}; x[k] = v; return x; }

class Timing {
  static completeCard(card, result) {
    const selector = make(card.deck, {$exists: true});
    const update = {$inc: make(card.deck, 1)};
    if (mCounts.update(selector, update)) {
      if (card.deck === 'failures') {
        Vocabulary.clearFailed(card.data);
      } else {
        Vocabulary.updateItem(card.data, result, false /* correction */);
      }
    } else {
      console.error('Failed to update card:', card, 'with result:', result);
      Timing.shuffle();
    }
  }
  static getNextCard() {
    return next_card.get();
  }
  static getRemainder() {
    return remainder.get();
  }
  static getTimeLeft() {
    return time_left.get();
  }
  static shuffle() {
    shuffle();
  }
}

export {Timing}