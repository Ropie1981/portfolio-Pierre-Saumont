import { Component, inject } from "@angular/core";
import { NavbarComponent } from "./components/navbar/navbar.component";
import { HomeComponent } from "./components/home/home.component";
import { AboutComponent } from "./components/about/about.component";
import { SkillsComponent } from "./components/skills/skills.component";
import { ExperienceComponent } from "./components/experience/experience.component";
import { ProjectsComponent } from "./components/projects/projects.component";
import { ContactComponent } from "./components/contact/contact.component";
import { FooterComponent } from "./components/footer/footer.component";
import { BeatboxComponent } from "./components/beatbox/beatbox.component";
import { AppStateService } from "./services/app-state.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    NavbarComponent,
    HomeComponent,
    AboutComponent,
    SkillsComponent,
    ExperienceComponent,
    ProjectsComponent,
    ContactComponent,
    FooterComponent,
    BeatboxComponent,
  ],
  template: `
    <div class="grain-overlay"></div>
    <app-navbar />

    @if (appState.showBeatbox()) {
      <app-beatbox />
    } @else {
      <main>
        <app-home />
        <app-about />
        <app-skills />
        <app-experience />
        <app-projects />
        <app-contact />
      </main>
      <app-footer />
    }
  `,
})
export class AppComponent {
  appState = inject(AppStateService);
}
