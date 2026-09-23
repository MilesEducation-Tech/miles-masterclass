import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MGINorthAmerica } from './mgi-north-america';

describe('MGINorthAmerica', () => {
  let component: MGINorthAmerica;
  let fixture: ComponentFixture<MGINorthAmerica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MGINorthAmerica],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MGINorthAmerica);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
