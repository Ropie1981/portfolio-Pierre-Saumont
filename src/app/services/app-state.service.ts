import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class AppStateService {
  showBeatbox = signal(false);

  openBeatbox() {
    this.showBeatbox.set(true);
  }
  closeBeatbox() {
    this.showBeatbox.set(false);
  }
}
