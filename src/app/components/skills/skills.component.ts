import { Component } from "@angular/core";

@Component({
  selector: "app-skills",
  standalone: true,
  templateUrl: "./skills.component.html",
  styleUrl: "./skills.component.scss",
})
export class SkillsComponent {
  mainSkills = [
    { name: "Angular", level: 85, color: "var(--color-primary)" },
    { name: "TypeScript", level: 82, color: "var(--color-primary)" },
    { name: "Symfony", level: 68, color: "var(--color-secondary)" },
    { name: "API Rest", level: 78, color: "var(--color-secondary)" },
    { name: "React.js", level: 60, color: "var(--color-tertiary)" },
    { name: "SCSS", level: 80, color: "var(--color-primary)" },
    { name: "MySQL", level: 65, color: "var(--color-secondary)" },
    { name: "AWS", level: 55, color: "var(--color-tertiary)" },
    { name: "Git", level: 80, color: "var(--color-secondary)" },
    { name: "Agile", level: 75, color: "var(--color-primary)" },
  ];

  skillGroups = [
    {
      category: "Front-End",
      color: "var(--color-primary)",
      skills: [
        "Angular",
        "TypeScript",
        "React.js",
        "HTML5",
        "CSS3/SCSS",
        "Tailwind",
      ],
    },
    {
      category: "Back-End",
      color: "var(--color-secondary)",
      skills: ["Symfony", "API Platform", "NodeJS", "Express", "API REST"],
    },
    {
      category: "Données & Cloud",
      color: "var(--color-tertiary)",
      skills: ["MySQL", "AWS", "CI/CD", "Docker"],
    },
    {
      category: "Workflow",
      color: "var(--color-primary)",
      skills: ["Git / GitHub", "Agile/Scrum", "Code Review", "Git Flow"],
    },
  ];

  getVuBars(level: number): { i: number; active: boolean }[] {
    const total = 8;
    const active = Math.round((level / 100) * total);
    return Array.from({ length: total }, (_, i) => ({ i, active: i < active }));
  }
}
