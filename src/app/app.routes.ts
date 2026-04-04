import { Routes } from "@angular/router";
import { HomeComponent } from "./components/home/home.component";
import { BeatboxComponent } from "./components/beatbox/beatbox.component";

export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "beatbox", component: BeatboxComponent },
];
