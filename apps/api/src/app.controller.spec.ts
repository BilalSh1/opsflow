import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = testingModule.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return a healthy API status', () => {
      const result = appController.getHealth();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('opsflow-api');
      expect(result.timestamp).toBeDefined();
    });
  });
});
