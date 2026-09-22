class PenaltyScene extends Phaser.Scene {
  constructor() {
    super('PenaltyScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1b7a4d);

    const goalY = height * 0.28;
    const goalWidth = width * 0.55;
    const goalX = width / 2;

    this.add.rectangle(goalX, goalY, goalWidth, 8, 0xffffff);
    this.add.rectangle(goalX - goalWidth / 2, goalY + 40, 8, 80, 0xffffff);
    this.add.rectangle(goalX + goalWidth / 2, goalY + 40, 8, 80, 0xffffff);

    const net = this.add.graphics();
    net.lineStyle(1, 0xffffff, 0.35);
    for (let x = -goalWidth / 2; x <= goalWidth / 2; x += 14) {
      net.lineBetween(goalX + x, goalY, goalX + x, goalY + 80);
    }
    for (let y = 0; y <= 80; y += 14) {
      net.lineBetween(goalX - goalWidth / 2, goalY + y, goalX + goalWidth / 2, goalY + y);
    }

    this.keeperStartX = goalX;
    this.keeper = this.add.container(goalX, goalY + 70);
    const keeperBody = this.add.rectangle(0, 0, 26, 46, 0xf5b942);
    const keeperHead = this.add.circle(0, -32, 14, 0xffdcb2);
    this.keeper.add([keeperBody, keeperHead]);

    this.ballStartPos = { x: width / 2, y: height * 0.82 };
    this.ball = this.add.circle(this.ballStartPos.x, this.ballStartPos.y, 14, 0xffffff);
    this.ball.setStrokeStyle(2, 0x222222);

    this.resultText = this.add.text(width / 2, height * 0.55, '', {
      fontFamily: 'Baloo 2, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  resetShot() {
    this.ball.setPosition(this.ballStartPos.x, this.ballStartPos.y);
    this.keeper.setPosition(this.keeperStartX, this.keeper.y);
    this.resultText.setText('');
  }

  animateKick(isCorrect, onComplete) {
    const goalX = this.keeperStartX;
    const targetX = isCorrect
      ? goalX + (Math.random() < 0.5 ? -1 : 1) * 90
      : goalX;

    this.tweens.add({
      targets: this.ball,
      x: targetX,
      y: this.ball.y - (this.ball.y - (this.scale.height * 0.28 + 40)),
      duration: 550,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (isCorrect) {
          this.tweens.add({ targets: this.keeper, x: goalX + (targetX > goalX ? -30 : 30), duration: 300 });
          this.resultText.setText('GOOOOL! ⚽').setColor('#2e9e5b');
        } else {
          this.resultText.setText('Quase! Vamos de novo 🙂').setColor('#4a6fa5');
        }
        this.time.delayedCall(1200, () => {
          this.resetShot();
          if (onComplete) onComplete();
        });
      },
    });
  }
}
