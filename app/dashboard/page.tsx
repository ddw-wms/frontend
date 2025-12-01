<Box
  sx={{
    display: "grid",
    gridTemplateColumns: {
      xs: "repeat(5, 1fr)", // mobile: 5 columns
      sm: "repeat(5, 1fr)",
      md: "repeat(5, 1fr)",
    },
    gap: 1,
    p: 1,
  }}
>
  {[
    { label: "Master Data", value: metrics.total, color: "#6366f1" },
    { label: "Inbound", value: metrics.inbound, color: "#3b82f6" },
    { label: "QC", value: metrics.qcPassed, color: "#10b981" },
    { label: "Picking", value: metrics.pickingCompleted, color: "#f59e0b" },
    { label: "Dispatch", value: metrics.outboundDispatched, color: "#ef4444" },
  ].map((m, index) => (
    <Card
      key={index}
      sx={{
        p: { xs: 0.5, md: 1.5 }, // mobile: small padding
        textAlign: "center",
        border: `2px solid ${m.color}`,
        borderRadius: 1.5,
        minWidth: { xs: 55, md: "auto" }, // mobile me chhota width
      }}
    >
      <Typography
        sx={{
          fontWeight: 700,
          color: m.color,
          fontSize: { xs: "0.75rem", md: "1rem" }, // mobile font chhota
        }}
      >
        {m.value}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: "0.55rem", md: "0.75rem" }, // mobile caption chhota
        }}
        variant="caption"
      >
        {m.label}
      </Typography>
    </Card>
  ))}
</Box>
