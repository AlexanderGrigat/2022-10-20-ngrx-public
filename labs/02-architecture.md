- [1. Customers Api for Booking](#1-customers-api-for-booking)
- [2. Repository](#2-repository)
  - [2.1 Internal](#21-internal)
  - [2.2 API module](#22-api-module)
  - [2.3. Repository++](#23-repository)
- [3. ViewModel vs. StateModel](#3-viewmodel-vs-statemodel)
- [4. Bonus](#4-bonus)
  - [4.1. UI and Container Component for RequestInfo](#41-ui-and-container-component-for-requestinfo)
  - [4.2 Multi-Levels in Container/UI components](#42-multi-levels-in-containerui-components)
  - [4.3 Repository Pattern as port & adapter](#43-repository-pattern-as-port--adapter)

## 1. Customers Api for Booking

The bookings module has a dependency to customers. Open _bookings.effects.ts_ and _bookings.selectors.ts_ in `bookings`. You'll find an import of the selector `selectSelectedCustomer`.

That violates our dependency rules. The linter didn't report it, because we cheated 😅 and disabled eslint for that line.

Create a new library `customers-api` which only exposes the `selectSelectedCustomer` selector from `customers-api`.

1. Create a dependency from `bookings` to `customer-api`,
2. setup the rules in _/eslint.json_, and
3. tag the two projects appropriately.

<details>
<summary>Show Solution</summary>
<p>

**1. Create `customers-api`**

Run `npx nx g @nrwl/angular:library api --directory customers --skip-module`.

We only need to export the selector in the _index.ts_ of `customers-api`:

```typescript
import { fromCustomers } from '@eternal/customers/data';

export const selectSelectedCustomer = fromCustomers.selectSelectedCustomer;
```

We can now also remove the export of the `selectSelectedCustomer` in `customers-feature`. It should only export `customersRoutes`.

**2. `bookings` -> `customer-api`**

Update the imports in _booking.effects.ts_ and _booking.selectors.ts_ so that they import from `customers-api`.

**3. Tag `customers-api`**

Add the following value to the property `tags` in the _project.json_ of `customers-api`: `["domain:customers:api", "type:api"]`.

**4. Dependency rules**

Open _/eslintrc.json_. We have to deal with four rules.

1. Update the rule that applies to `domain:bookings`:

```json
{
  "sourceTag": "domain:bookings",
  "onlyDependOnLibsWithTags": [
    "domain:bookings",
    "domain:customers:api",
    "domain:shared"
  ]
}
```

2. Add a new rule for `domain:customers:api` with `{"sourceTag": "domain:customers:api", "onlyDependsOnLibWithTags": ["domain:customers"]}`.

3. Add a new rule for `type:api` with

```json
{
  "sourceTag": "type:api",
  "onlyDependOnLibWithTags": [
    "type:feature",
    "type:data",
    "type:ui",
    "type:model"
  ]
}
```

1. Add `type:api` to the generic rule on `type:feature`. This gives every feature module generic access to api modules.

```json
{
  "sourceTag": "type:feature",
  "onlyDependOnLibWithTags": [
    "type:api", // <-- this is new
    "type:data",
    "type:ui",
    "type:model"
    // ...
  ]
}
```

**5. Final check**

- Run `npm run full-check`. This time, it should work.

- Cross-check: In _holidays.components.ts_ of `holidays-feature`, add `this.#store.select(selectSelectedCustomer);` to the constructor and re-run the linter. It should fail.

</p>
</details>

## 2. Repository

In order to simplify the usage of NgRx, we are going to hide it 😃. We apply the facade/repository pattern. One internal version internal and for the outside of customers via the `customers-api`.

### 2.1 Internal

1. Create a service `CustomersRepository` which exposes the public actions as simple methods and the selectors as properties.
2. Make sure that `customers-data` only exposes that `CustomersRepository` and the `customersDataProvider`.
3. Use the repository in the container components and the data guard of `customers-feature`.

<details>
<summary>Show Solution</summary>
<p>

**1. Create a repository and encapsulate actions**

Create a new service _customers-repository.service.ts_ in `customers-data`:

```typescript
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { customersActions } from './customers.actions';
import { Customer } from '@eternal/customers/model';

@Injectable({ providedIn: 'root' })
export class CustomersRepository {
  #store = inject(Store);

  load(page: number = 1): void {
    this.#store.dispatch(customersActions.load({ page }));
  }

  add(customer: Customer): void {
    this.#store.dispatch(customersActions.add({ customer }));
  }

  update(customer: Customer): void {
    this.#store.dispatch(customersActions.update({ customer }));
  }

  remove(customer: Customer): void {
    this.#store.dispatch(customersActions.remove({ customer }));
  }

  select(id: number): void {
    this.#store.dispatch(customersActions.select({ id }));
  }

  unselect(): void {
    this.#store.dispatch(customersActions.unselect());
  }
}
```

**2. Add selectors as properties**

```typescript
@Injectable({ providedIn: 'root' })
export class CustomersRepository {
  #store = inject(Store);

  readonly customers$: Observable<Customer[]> = this.#store.select(
    fromCustomers.selectCustomers
  );

  readonly pagedCustomers$: Observable<{
    customers: (Customer & { selected: boolean })[];
    total: number;
    page: number;
  }> = this.#store.select(fromCustomers.selectPagedCustomers);

  readonly selectedCustomer$: Observable<Customer | undefined> =
    this.#store.select(fromCustomers.selectSelectedCustomer);

  findById(id: number): Observable<Customer | undefined> {
    return this.#store.select(fromCustomers.selectById(id));
  }

  // ... methods for actions
}
```

**3. Update the container components, data guard and \*index.ts\* of `customers-feature`**

Take a look at the selector generated in `CustomersContainerComponent`. Does it make sense to create a selector in a container component when we just placed the complete NgRx behind a repository?

</p>
</details>

### 2.2 API module

We can't expose the `CustomersRepository` to external domains like booking. It's much too powerful. Therefore, create a minimal version which only exposes the selector.

There are two possibilities. If you want to completely hide NgRx from the rest of your application, you cannot export the selector, but need a repository-like service. As a consequence, _booking.selectors.ts_ will not work anymore, and you have to fallback to `combinateLatest`. The other possibility would be that the `customers-api` exposes the selector.

You have to choose between better architecture and NgRx performance. If you favour NgRx performance, you will have to expose `selectSelectedCustomer` from `customers-api`.

The solutions show the second approach, where architecture is favoured over performance.

<details>
<summary>Solution: Hiding the NgRx Selector</summary>
<p>

**1. Service `CustomersApi`**

Create a new file _customers-api.service.ts_ in `customers-api`:

```typescript
import { inject, Injectable } from '@angular/core';
import { CustomersRepository } from '@eternal/customers/data';
import { Observable } from 'rxjs';
import { Customer } from '@eternal/customers/model';

@Injectable({
  providedIn: 'root',
})
export class CustomersApi {
  readonly selectedCustomer$: Observable<Customer> =
    inject(CustomersRepository).selectedCustomer$;
}
```

The _index.ts_ in `customers-api` only exposes the `CustomersApi`. The selector is encapsulated and can be removed.

**2. Update `bookings`**

1. Remove _bookings.selectors.ts_. We don't have use for that anymore.

2. In _bookings.effects.ts_, replace the usage of store with `CustomersApi`:

```typescript
@Injectable()
export class BookingsEffects {
  #customersApi = inject(CustomersApi);
  #actions$ = inject(Actions);

  load$ = createEffect(() => {
    return this.#actions$.pipe(
      ofType(bookingsActions.load),
      concatLatestFrom(() => this.#customersApi.selectedCustomer$), // ← replace with this
      map(([, customerId]) => customerId),
      filter(Boolean),
      map((customer) =>
        bookingsActions.loaded({ bookings: bookings.get(customer.id) || [] })
      )
    );
  });
}
```

3. `bookings` needs its own internal repository which replaces the former bookingData selector:

Create a new file _bookings-repository.service.ts_:

```typescript
import { combineLatest, filter, map, Observable } from 'rxjs';
import { Booking, bookingsFeature } from './bookings.reducer';
import { isDefined } from '@eternal/shared/util';
import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { CustomersApi } from '@eternal/customers/api';

interface BookingData {
  bookings: Booking[];
  customerName: string;
  loaded: boolean;
}

@Injectable({ providedIn: 'root' })
export class BookingsRepository {
  #store = inject(Store);
  #customersApi = inject(CustomersApi);

  readonly bookingsData$: Observable<BookingData> = combineLatest({
    customer: this.#customersApi.selectedCustomer$,
    bookings: this.#store.select(bookingsFeature.selectBookings),
    loaded: this.#store.select(bookingsFeature.selectLoaded),
  }).pipe(
    filter(({ customer }) => isDefined(customer)),
    map(({ customer, bookings, loaded }) => {
      return {
        customerName: customer.name + ', ' + customer.firstname,
        bookings,
        loaded,
      };
    })
  );
}
```

4. Update the _overview.component.ts_ too. It

```typescript
export class OverviewComponent implements OnInit {
  // ...

  #store = inject(Store);
  #bookingsRepository = inject(BookingsRepository);

  // ...

  ngOnInit(): void {
    // ↓ replace with this
    this.#bookingsRepository.bookingsData$.subscribe((bookingData) => {
      if (bookingData?.loaded === false) {
        this.#store.dispatch(bookingsActions.load());
      } else {
        this.userName = bookingData.customerName;
        this.dataSource.data = bookingData.bookings;
      }
    });
  }
}
```

</p>
</details>

### 2.3. Repository++

The `CustomersRepository` isn't just a facade. Extend it with following features:

- Immutability: We are directly passing our state slices to components. If the components would do mutable changes (like via template-driven forms), we would have a problem. Make sure that our repository returns cloned versions of these state slices.
- No undefined results: `findById()` and `selectedCustomer$` should return `Observable<Customer>` instead of `Observable<Customer | undefined>`.

Make use of the RxJs operators `filterDefined` and `clone` from `shared-ngrx-utils`.

<details>
<summary>Show Solution</summary>
<p>

_customers-repository.service.ts_

```typescript
@Injectable({ providedIn: 'root' })
export class CustomersRepository {
  readonly customers$: Observable<Customer[]> = this.store
    .select(fromCustomers.selectCustomers)
    .pipe(deepClone);

  readonly pagedCustomers$: Observable<{
    customers: (Customer & { selected: boolean })[];
    total: number;
    page: number;
  }> = this.store.select(fromCustomers.selectPagedCustomers);

  readonly selectedCustomer$: Observable<Customer> = this.store
    .select(fromCustomers.selectSelectedCustomer)
    .pipe(filterDefined, deepClone);

  findById(id: number): Observable<Customer> {
    return this.store
      .select(fromCustomers.selectById(id))
      .pipe(filterDefined, deepClone);
  }

  constructor(private store: Store) {}

  // ...
}
```

Make sure to update _edit-customer.component.ts_ and _customers-api.services.ts_ (return signature) as well.

</p>
</details>

## 3. ViewModel vs. StateModel

Another "hard to decide" trade-off. We have one state structure but multiple view structures, aka. view models. Usually, selectors do the mapping because of their caching capabilities.

Looking at the situation from an architecture's perspective, we want to limit the knowledge of state management about our UI models. It is the same vice versa. That definitely makes sense, when the mapping to a view model requires dependency injection, advanced operators (filter, async), and another alien feature state.

Split up the bookings overview into a container and a presentational component. The presentational component should define its own view model, the container component should combine `CustomerApi` with `BookingRepository` to construct that view model. As a consequence, `BookingRepository` provides only the bookings selectors `bookings$` and `loaded$`.

<details>
<summary>Show Solution</summary>
<p>

**1. Presentational component**

Rename `OverviewComponent` into `OverviewContainerComponent` and update the folder and file names. Update `bookings-routes.ts` as well. After that, create the actual presentational component:

```bash
npx nx g c overview --project bookings --inline-style --skip-tests --standalone
```

_overview.component.ts_

```typescript
import { Component, Input } from '@angular/core';
import { Booking } from '../+state/bookings.reducer';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';

export interface ViewModel {
  bookings: Booking[];
  customerName: string;
}

@Component({
  selector: 'eternal-overview',
  templateUrl: './overview.component.html',
  standalone: true,
  imports: [MatTableModule, CommonModule],
})
export class OverviewComponent {
  @Input() viewModel: ViewModel | undefined;
  displayedColumns = ['holidayId', 'date', 'status', 'comment'];
  dataSource = new MatTableDataSource<Booking>([]);
}
```

_overview.component.html_

```html
<ng-container *ngIf="viewModel">
  <h1>Bookings for {{ viewModel.customerName }}</h1>

  <div class="my-4 max-w-screen-sm">
    <mat-table [dataSource]="viewModel.bookings">
      <ng-container matColumnDef="holidayId">
        <mat-header-cell *matHeaderCellDef> Holiday</mat-header-cell>
        <mat-cell *matCellDef="let element">{{ element.holidayId }} </mat-cell>
      </ng-container>

      <ng-container matColumnDef="date">
        <mat-header-cell *matHeaderCellDef> Booking Date </mat-header-cell>
        <mat-cell *matCellDef="let element">{{ element.date | date }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="status">
        <mat-header-cell *matHeaderCellDef> Status </mat-header-cell>
        <mat-cell *matCellDef="let element">{{ element.status }}</mat-cell>
      </ng-container>

      <ng-container matColumnDef="comment">
        <mat-header-cell *matHeaderCellDef> </mat-header-cell>
        <mat-cell *matCellDef="let element" class="basis-6/12"
          >{{ element.comment }}</mat-cell
        >
      </ng-container>

      <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
      <mat-row *matRowDef="let row; columns: displayedColumns"></mat-row>
    </mat-table>
  </div>
</ng-container>
```

**2. Modify `BookingsRepository`**

The repository doesn't need to use the `CustomerApi` anymore:

_bookings-repository.service.ts_

```typescript
import { Observable } from 'rxjs';
import { Booking, bookingsFeature } from './bookings.reducer';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as bookingsActions from './bookings.actions';

@Injectable({ providedIn: 'root' })
export class BookingsRepository {
  #store = inject(Store);

  readonly bookings$: Observable<Booking[]> = this.#store.select(
    bookingsFeature.selectBookings
  );
  readonly loaded$: Observable<boolean> = this.#store.select(
    bookingsFeature.selectLoaded
  );

  load(): void {
    this.#store.dispatch(bookingsActions.load());
  }
}
```

**3. Container component**

The container component for overview is responsible for setting up the view model as required by the presentational component:

_overview-container-component.module.ts_

```typescript
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { OverviewContainerComponent } from './overview-container.component';
import { OverviewComponentModule } from '../overview/overview.component.module';

@NgModule({
  declarations: [OverviewContainerComponent],
  exports: [OverviewContainerComponent],
  imports: [CommonModule, OverviewComponentModule],
})
export class OverviewContainerComponentModule {}
```

_overview-container.component.ts_

```typescript
import { Component, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { BookingsRepository } from '../+state/bookings-repository.service';
import { CustomersApi } from '@eternal/customers/api';
import { OverviewComponent, ViewModel } from '../overview/overview.component';
import { combineLatest, filter, map, Observable } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { LetModule } from '@ngrx/component';

@Component({
  selector: 'eternal-overview-container',
  template: `<eternal-overview
    *ngrxLet="viewModel$ as viewModel"
    [viewModel]="viewModel"
  ></eternal-overview>`,
  standalone: true,
  imports: [MatTableModule, OverviewComponent, AsyncPipe, NgIf, LetModule],
})
export class OverviewContainerComponent {
  #bookingsRepository = inject(BookingsRepository);
  #customersApi = inject(CustomersApi);

  // we have here two bugs which we'll eliminate later...
  readonly viewModel$: Observable<ViewModel> = combineLatest({
    bookings: this.#bookingsRepository.bookings$,
    loaded: this.#bookingsRepository.loaded$,
    customer: this.#customersApi.selectedCustomer$,
  }).pipe(
    filter(({ loaded }) => {
      if (loaded === false) {
        this.#bookingsRepository.load();
      }
      return loaded;
    }),
    map(({ customer, bookings }) => ({
      customerName: `${customer.name}, ${customer.firstname}`,
      bookings,
    }))
  );
}
```

</p>
</details>

## 4. Bonus

### 4.1. UI and Container Component for RequestInfo

Try to split the `RequestInfoComponent` in `holidays-feature` into a container and a presentational component.

### 4.2 Multi-Levels in Container/UI components

If you have multiple levels where a presentational component needs a container as child, you can use content project or a template reference for that.

### 4.3 Repository Pattern as port & adapter

It is also possible to switch the dependency between feature and data module types. The feaure can define the repository service as they want and it is the task of the data to provide that. In that sense, feature is not aware of data at all.
