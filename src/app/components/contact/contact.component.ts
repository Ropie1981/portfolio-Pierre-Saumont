import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-contact",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
})
export class ContactComponent {
  submitted = signal(false);
  form = { name: "", email: "", subject: "", message: "" };

  onSubmit() {
    // In production, wire this to a real backend/email service
    console.log("Form submitted:", this.form);
    this.submitted.set(true);
    setTimeout(() => this.submitted.set(false), 4000);
    this.form = { name: "", email: "", subject: "", message: "" };
  }
}
