import { importProvidersFrom } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { SecurityEffects } from './security.effects';
import { securityFeature } from './security.reducer';

export const securityProvider = importProvidersFrom(
  StoreModule.forFeature(securityFeature),
  EffectsModule.forFeature([SecurityEffects])
);
