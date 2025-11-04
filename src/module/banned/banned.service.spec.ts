import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BannedService } from './banned.service';
import { Banned } from 'src/shared/entities/banned.entity';
import { Person } from 'src/shared/entities/person.entity';
import { BannedPlace } from 'src/shared/entities/bannedPlace.entity';
import { Place } from 'src/shared/entities/place.entity';
import { BannedHistory } from 'src/shared/entities/bannedHistory.entity';
import { UserService } from '../user/user.service';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRole } from '../user/user.entity';

type MockRepo<T> = Partial<Record<keyof Repository<T>, jest.Mock>> & {
  findOne?: jest.Mock;
  save?: jest.Mock;
  createQueryBuilder?: any;
};

function createMockRepo<T>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as MockRepo<T>;
}

describe('BannedService - addViolation', () => {
  let service: BannedService;
  let bannedRepo: MockRepo<Banned>;
  let bannedPlaceRepo: MockRepo<BannedPlace>;
  let placeRepo: MockRepo<Place>;
  let historyRepo: MockRepo<BannedHistory>;
  let personRepo: MockRepo<Person>;
  let userService: { findById: jest.Mock };

  beforeEach(async () => {
    bannedRepo = createMockRepo<Banned>();
    bannedPlaceRepo = createMockRepo<BannedPlace>();
    placeRepo = createMockRepo<Place>();
    historyRepo = createMockRepo<BannedHistory>();
    personRepo = createMockRepo<Person>();
    userService = { findById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        BannedService,
        { provide: getRepositoryToken(Banned), useValue: bannedRepo },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(BannedPlace), useValue: bannedPlaceRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(BannedHistory), useValue: historyRepo },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(BannedService);
  });

  it('should forbid non manager/head-manager', async () => {
    userService.findById.mockResolvedValue({ id: 'u1', role: UserRole.STAFF });
    await expect(service.addViolation('ban1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should throw NotFound when user not found', async () => {
    userService.findById.mockResolvedValue(null);
    await expect(service.addViolation('ban1', 'uX')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should increment violations and append date for manager within same city', async () => {
    const now = new Date('2024-01-01T00:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    userService.findById.mockResolvedValue({
      id: 'm1',
      role: UserRole.MANAGER,
      place: { city: 'FooCity' },
    });

    const banned: Partial<Banned> = {
      id: 'ban1',
      violationsCount: 1,
      violationDates: [new Date('2023-12-31T00:00:00Z')],
      bannedPlaces: [
        {
          bannedId: 'ban1',
          placeId: 'p1',
          place: { id: 'p1', name: 'P1', city: 'FooCity' } as Place,
        } as unknown as BannedPlace,
      ],
    };

    bannedRepo.findOne!.mockResolvedValue(banned);
    bannedRepo.save!.mockImplementation(async (entity: Banned) => entity);

    const result = await service.addViolation('ban1', 'm1');
    expect(result.violationsCount).toBe(2);
    expect(Array.isArray(result.violationDates)).toBe(true);
    expect(result.violationDates.length).toBe(2);
    expect(new Date(result.violationDates[1] as any).toISOString()).toBe(now.toISOString());

    jest.useRealTimers();
  });
});

describe('BannedService - create guard for existing active ban in user place', () => {
  let service: BannedService;
  let bannedRepo: MockRepo<Banned>;
  let bannedPlaceRepo: MockRepo<BannedPlace>;
  let placeRepo: MockRepo<Place>;
  let historyRepo: MockRepo<BannedHistory>;
  let personRepo: MockRepo<Person>;
  let userService: { findById: jest.Mock };

  beforeEach(async () => {
    bannedRepo = createMockRepo<Banned>();
    bannedPlaceRepo = createMockRepo<BannedPlace>();
    placeRepo = createMockRepo<Place>();
    historyRepo = createMockRepo<BannedHistory>();
    personRepo = createMockRepo<Person>();
    userService = { findById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        BannedService,
        { provide: getRepositoryToken(Banned), useValue: bannedRepo },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(BannedPlace), useValue: bannedPlaceRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(BannedHistory), useValue: historyRepo },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(BannedService);
  });

  it('should block create when active ban exists in user place (manager)', async () => {
    userService.findById.mockResolvedValue({ id: 'm1', role: UserRole.MANAGER, placeId: 'p1', place: { city: 'Foo' } });
    personRepo.findOne!.mockResolvedValue({ id: 'person1' } as Person);

    const qbMock: any = {
      leftJoin: () => qbMock,
      where: () => qbMock,
      andWhere: () => qbMock,
      getOne: jest.fn().mockResolvedValue({ id: 'banExisting' }),
    };
    (bannedRepo as any).createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    await expect(
      service.create(
        {
          personId: 'person1',
          incidentNumber: 1,
          startingDate: new Date().toISOString(),
          endingDate: new Date(Date.now() + 86400000).toISOString(),
          motive: [],
          policeNotified: false,
          placeIds: ['p1', 'p2'],
        } as any,
        'm1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should allow create when no active ban in user place', async () => {
    userService.findById.mockResolvedValue({ id: 'm1', role: UserRole.MANAGER, placeId: 'p1', place: { city: 'Foo' } });
    personRepo.findOne!.mockResolvedValue({ id: 'person1' } as Person);

    const qbMock: any = {
      leftJoin: () => qbMock,
      where: () => qbMock,
      andWhere: () => qbMock,
      getOne: jest.fn().mockResolvedValue(null),
    };
    (bannedRepo as any).createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    // Minimal save path dependencies
    (placeRepo as any).find = jest.fn().mockResolvedValue([{ id: 'p2' }] as any);
    (bannedPlaceRepo as any).save = jest.fn().mockResolvedValue([]);
    (bannedPlaceRepo as any).create = jest.fn().mockImplementation((x: any) => x);
    (bannedRepo as any).create = jest.fn().mockImplementation((x: any) => ({ id: 'newBan', ...x }));
    (bannedRepo as any).save = jest.fn().mockImplementation(async (x: any) => x);
    (historyRepo as any) = historyRepo;
    (historyRepo as any).save = jest.fn();
    (historyRepo as any).create = jest.fn().mockImplementation((x: any) => x);

    const result = await service.create(
      {
        personId: 'person1',
        incidentNumber: 1,
        startingDate: new Date().toISOString(),
        endingDate: new Date(Date.now() + 86400000).toISOString(),
        motive: [],
        policeNotified: false,
        placeIds: ['p2'],
      } as any,
      'm1',
    );
    expect(result.id).toBe('newBan');
  });
});


