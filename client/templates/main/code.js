/*
 *  Copyright 2016 Shaunak Kishore (kshaunak "at" gmail.com)
 *
 *  This file is part of Inkstone.
 *
 *  Inkstone is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Inkstone is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Inkstone.  If not, see <http://www.gnu.org/licenses/>.
 */

import {Settings} from '/client/model/settings';
import {Timing} from '/client/model/timing';
import {Vocabulary} from '/client/model/vocabulary';

// Set up the routing table and transitioner.

Router.configure({layoutTemplate: 'layout'});
Router.route('index', {path: '/'});
Router.route('teach', {
  onStop() {
    const card = Timing.getNextCard();
    if (card && card.deck !== 'errors') Timing.shuffle();
  },
});
['credits', 'help', 'lists', 'settings', 'stats'].map((x) => Router.route(x));

Transitioner.default({in: 'transition.fadeIn', out: 'transition.fadeOut'});

// Set up global template helpers.

const kDisabledEvents = {'native.keyboardhide': 1, 'native.keyboardshow': 1};

if (Meteor.isCordova) {
  Meteor.disconnect();
  const fireWindowEvent = cordova.fireWindowEvent;
  cordova.fireWindowEvent = (type, data) => {
    if (!kDisabledEvents[type]) fireWindowEvent(type, data);
  }
}

Platform.isAndroid = () => false;
Platform.isIOS = () => true;

Template.layout.helpers({
  remainder: () => {
    const x = Timing.getRemainder();
    let left = '' + (x ? x.adds + x.extras + x.reviews : '?');
    if (Settings.get('revisit_failures')) {
      left += ' + ' + (x ? x.failures : '?');
    }
    if (Vocabulary.getNewItems().count() !== 0) {
      const ts = Date.timestamp();
      left += ' (';
      left += Vocabulary.getItemsDueBy(ts, ts).count() + ' total, ';
      left += Vocabulary.getNewItems().count() + ' unseen'
      left += ')';
    }
    return left;
  },
  theme: () => {
    return Settings.get('paper_filter') ? 'textured' : 'painterly';
  },
  time: () => {
    const time = Timing.getTimeLeft();
    if (time === undefined) return '?:?';
    const pad = (value) => value.length < 2 ? '0' + value : value;
    return [
      Math.floor(time / 3600),
      pad('' + (Math.floor(time / 60) % 60)),
    ].join(':');
  }
});
