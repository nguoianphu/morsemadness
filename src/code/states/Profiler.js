import Phaser from 'phaser'
import config from '../config'
import { MorseQ, signals, morseFactory, SIGNAL_DIFFICULTY } from '../actors/morsetx'
import Operator from '../actors/operator'
import { Gamepad } from '../gamepad/gamepad'
import Score from '../score'
import { sendDesignEvent, sendStartEvent, sendCompleteEvent } from '../analytics'
const arrayToCSV = require('array-to-csv');
const SECOND = Phaser.Timer.SECOND;

export default class extends Phaser.State {
  create() {
    this.signalQ = new MorseQ();
    this.generate = false;
    this.level = 'Training'
    this.currentTx = {
      time: 0,
      pattern: [],
      missed: 0,
      accuracy: 0,
      shots: 0,
      adjustedLength: 0,
      arrowValue: 0
    }
    this.pastTx = [];
    this.statsTx = {
      timeAverage: 0,
      missedAverage: 0,
      timeTotal: 0,
      missTotal: 0,
      totalArrows: 0,
      totalBullets: 0,
      accuracy: 0,
    }

    this.currentPatternTime = 0
    let profilerMap = Array(14)
    for (let i = 0; i < 7; i++) {
      profilerMap[i] = Array(config.horizontalTiles).fill(5);
    }
    profilerMap[7] = profilerMap[13] = Array(config.horizontalTiles).fill(2);
    for (let i = 8; i < 13; i++) {
      profilerMap[i] = Array(config.horizontalTiles).fill(1);
    }
    for (let i = 14; i < 20; i++) {
      profilerMap[i] = Array(config.horizontalTiles).fill(5);
    }
    profilerMap = arrayToCSV(profilerMap);
    this.game.cache.addTilemap('profiler', null, profilerMap, Phaser.Tilemap.CSV);
    this.map = this.game.add.tilemap('profiler', config.tileWidth, config.tileHeight);
    this.map.addTilesetImage('bricks');
    this.layer = this.map.createLayer(0);

    this.gArrows = this.game.add.group();
    this.gActors = this.game.add.group();

    this.gSignal = this.game.add.group();
    this.gSignal.enableBody = true;
    this.gSignal.physicsBodyType = Phaser.Physics.ARCADE;
    this.createSignals()

    this.operator = new Operator(
      this.game,
      32,
      game.world.centerY + 9,
      'operator',
      this.gSignal
    );
    this.game.add.existing(this.operator);
    this.operator.gamepad = new Gamepad(this.operator, 'pad1');
    this.score = new Score(this.game, 30, this.mazeY - 1);

    // current pattern text
    let currentTab = game.add.image(0, 0, 'current')
    let currentTextX = currentTab.x + currentTab.width + 8
    this.missedText = this.game.add.text(currentTextX, 0, '')
    this.timeText = this.game.add.text(currentTextX, 32, '')

    // tx stats text
    let averageTab = game.add.image(358, 0, 'average')
    let averageTextX = averageTab.x + averageTab.width + 8
    this.averageTimeText = this.game.add.text(averageTextX, 0, '')
    this.accuracyText = this.game.add.text(averageTextX, 32, '')
    this.totalArrowsText = this.game.add.text(averageTextX, 64, '')

    this.initializeText()

    //start stop button
    this.startButton = game.add.button(game.world.centerX - 48, 240, 'startbutton', this.toggleGeneration, this, 1, 0, 2);

  }
  initializeText() {
    this.updateStatsText()
    this.updateTimer()
  }
  createSignals() {
    this.gSignal.createMultiple(30, 'signal');
    this.gSignal.setAll('anchor.x', 0.5);
    this.gSignal.setAll('anchor.y', 0.5);
    this.gSignal.setAll('outOfBoundsKill', true);
    this.gSignal.setAll('checkWorldBounds', true);
  }
  toggleGeneration() {
    this.generate = !this.generate
    if (this.generate == true) {
      this.startButton.setFrames(4, 3, 5)
      this.setCurrentTransmission()
      sendStartEvent(this.level)
    } else {
      this.startButton.setFrames(1, 0, 2);
      this.clearGeneration();
      sendCompleteEvent(this.level, 0)
    }
  }
  clearGeneration() {
    this.gArrows.killAll()
    this.signalQ.reset()
  }

  miss() {
    this.currentTx.missed++
    this.missedText.setText('Missed ' + this.currentTx.missed)
  }

  generateMorse() {
    morseFactory(this.game, this.gArrows)
    this.gArrows.children.forEach(signal => {
      signal.y = signal.y + game.world.centerY - 32
    })
    this.updateCurrentTransmission()
  }

  /** 
   * updateCurrentTransmission() process and store the current transmission in 
   * past transmissions and updates the statistics object.
   */
  updateCurrentTransmission() {
    if (this.currentTx.pattern.length > 0) {
      this.currentTx.time = game.time.now - this.currentTx.time
      this.currentTx.shots = this.currentTx.miss + this.currentTx.pattern.length
      this.currentTx.accuracy = this.currentTx.miss / this.currentTx.shots
      this.currentTx.arrowValue = 1 / this.currentTx.accuracy
      this.currentTx.adjustedLength = this.currentTx.pattern.length * (this.currentTx.arrowValue)
      this.pastTx.push(Object.assign({}, this.currentTx))
      this.setStatistics(this.currentTx)
      this.sendGAEvents(this.currentTx)
      this.setCurrentTransmission()
    }
  }
  setStatistics(tx) {
    this.statsTx.missTotal += tx.missed
    this.statsTx.missedAverage = this.statsTx.missTotal / this.pastTx.length
    this.statsTx.timeTotal += tx.time
    this.statsTx.timeAverage = this.statsTx.timeTotal / this.pastTx.length
    this.statsTx.totalArrows += tx.pattern.length
    this.statsTx.totalBullets += (tx.pattern.length + this.statsTx.missTotal)
    this.statsTx.accuracy = 1 - (this.statsTx.missTotal / this.statsTx.totalBullets)
  }
  setCurrentTransmission() {
    this.currentTx.time = game.time.now
    this.currentTx.pattern = []
    this.currentTx.missed = 0
    this.currentTx.accuracy = 0
    this.currentTx.shots = 0
    this.currentTx.adjustedLength = 0
    this.currentTx.arrowValue = 0

  }
  storeCurrentTransmissions() {
    this.gArrows.forEachAlive(each => {
      this.currentTx.pattern += each.name
    })
  }
  collideActor(collider, actor) {
    actor.collide(collider);
  }
  sendGAEvents(tx) {
    // This could be a for using the property name for the event.
    this.sendProfilerEvent(tx.pattern, 'Accuracy', tx.accuracy)
    this.sendProfilerEvent(tx.pattern, 'Shots', tx.shots)
    this.sendProfilerEvent(tx.pattern, 'Missed', tx.missed)
    this.sendProfilerEvent(tx.pattern, 'Time', tx.time)
    this.sendProfilerEvent(tx.pattern, 'Length', tx.pattern.length)
    this.sendProfilerEvent(tx.pattern, 'AdjustedLength', tx.adjustedLength)
    this.sendProfilerEvent(tx.pattern, 'ArrowValue', tx.arrowValue)
  }
  sendProfilerEvent(pattern, event, value) {
    let dEvent = `Profiler:Transmission:${pattern}:${event}`
    sendDesignEvent(dEvent, value);
  }
  updateTimer() {
    let seconds = (this.currentPatternTime / SECOND).toFixed(2)
    this.timeText.setText('Time ' + seconds);
  }
  updateStatsText() {
    this.missedText.setText('Missed ' + this.currentTx.missed)
    let averageTime = (this.statsTx.timeAverage / SECOND).toFixed(2)
    this.averageTimeText.setText('Time/pattern: ' + averageTime)
    let acc = (this.statsTx.accuracy * 100).toFixed(2)
    this.accuracyText.setText('Accuracy: ' + acc + '%')
    this.totalArrowsText.setText('Arrows total: ' + this.statsTx.totalArrows)
  }
  update() {
    this.game.physics.arcade.overlap(this.gSignal, this.gArrows, this.collideActor);

    if (this.generate === true) {
      if (this.gArrows.countLiving() == 0) {
        this.gSignal.killAll();
        this.generateMorse();
        this.storeCurrentTransmissions()
        this.updateStatsText()
      }
      this.currentPatternTime = this.game.time.now - this.currentTx.time;
      this.updateTimer()
    }
  }

};