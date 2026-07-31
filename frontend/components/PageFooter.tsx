export function PageFooter({ className = "" }: { className?: string }) {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <footer className={`page-footer ${className}`.trim()}>
      <span className="page-footer-line" aria-hidden="true" />
      <span className="page-footer-om" aria-hidden="true">ॐ</span>
      <span className="page-footer-copy">
        Shree Durgaparameshwari Temple Kambar <b aria-label="registered">®</b> {year}
      </span>
      <span className="page-footer-line" aria-hidden="true" />
    </footer>
  );
}
