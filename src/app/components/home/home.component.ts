import { Component, OnInit, OnDestroy, signal } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
})
export class HomeComponent {
  tags = [
    { label: "Angular", color: "purple" },
    { label: "TypeScript", color: "purple" },
    { label: "Symfony", color: "green" },
    { label: "API Platform", color: "green" },
    { label: "React.js", color: "pink" },
    { label: "JavaScript", color: "pink" },
    { label: "MySQL", color: "purple" },
    { label: "Git", color: "green" },
  ];

  stats = [
    { value: "3", label: "Ans_en_poste" },
    { value: "20+", label: "Ans_pro_total" },
    { value: "3", label: "Vies pro" },
  ];

  tickerItems = [
    "Angular",
    "TypeScript",
    "Symfony",
    "API Platform",
    "React.js",
    "MySQL",
    "SCSS",
    "API REST",
    "Git Flow",
    "Agile/Scrum",
    "Node.js",
    "HTML5",
    "CSS3",
    "UX/UI",
    "GitLab",
    "Docker",
  ];

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }
}
