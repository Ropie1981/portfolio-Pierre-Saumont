import { Component } from "@angular/core";

@Component({
  selector: "app-footer",
  standalone: true,
  templateUrl: "./footer.component.html",
  styleUrl: "./footer.component.scss",
})
export class FooterComponent {
  year = new Date().getFullYear();
  angularVersion = "21";

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
