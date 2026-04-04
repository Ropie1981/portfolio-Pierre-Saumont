import { Component, signal, HostListener, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AppStateService } from "../../services/app-state.service";

@Component({
  selector: "app-navbar",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.scss",
})
export class NavbarComponent {
  appState = inject(AppStateService);

  isScrolled = signal(false);
  menuOpen = signal(false);

  @HostListener("window:scroll")
  onScroll() {
    this.isScrolled.set(window.scrollY > 60);
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  scrollTo(id: string) {
    if (this.appState.showBeatbox()) {
      this.appState.closeBeatbox();
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  }

  openBeatbox() {
    this.appState.openBeatbox();
    this.closeMenu();
    window.scrollTo({ top: 0 });
  }
}
