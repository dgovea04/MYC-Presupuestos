USE S10_OBRA_MYC;
GO

DECLARE @CodPresupuesto varchar(20) = '0201003';

SELECT
  JSON_QUERY((
    SELECT
      CodPresupuesto,
      Descripcion,
      Fecha,
      CostoOferta1,
      CostoDirectoOferta1,
      CostoIndirectoOferta1,
      CostoOfertaTotal1,
      CodMoneda1,
      DecimalesMetrado,
      DecimalesPrecioUnitario
    FROM dbo.Presupuesto
    WHERE CodPresupuesto = @CodPresupuesto
    FOR JSON PATH
  )) AS presupuestos,
  JSON_QUERY((
    SELECT
      CodPresupuesto,
      CodSubpresupuesto,
      Descripcion,
      CostoOferta1,
      CostoManoDeObra1,
      CostoMaterial1,
      CostoEquipo1,
      CostoSubcontrato1,
      CostoSubpartida1
    FROM dbo.Subpresupuesto
    WHERE CodPresupuesto = @CodPresupuesto
    FOR JSON PATH
  )) AS subpresupuestos,
  JSON_QUERY((
    SELECT
      CodPresupuesto,
      CodSubpresupuesto,
      Item,
      Orden,
      Secuencial,
      Descripcion,
      Unidad,
      Metrado,
      MetradoBase,
      Precio1,
      Parcial1,
      ManoDeObra1,
      Material1,
      Equipo1,
      Subcontrato1,
      Subpartida1,
      Nivel,
      CodPartida,
      CodPresupuestoPartida,
      PropioPartida
    FROM dbo.SubpresupuestoDetalle
    WHERE CodPresupuesto = @CodPresupuesto
      AND CodPartida IS NOT NULL
      AND CodPartida <> '999999999999'
      AND ISNULL(Tipo, 1) <> 0
    ORDER BY CodSubpresupuesto, Orden, Item, Secuencial
    FOR JSON PATH
  )) AS subpresupuestoDetalles,
  JSON_QUERY((
    SELECT
      partida.CodPresupuesto,
      partida.CodSubpresupuesto,
      partida.CodPartida,
      partida.CodPresupuestoPartida,
      partida.Precio1,
      partida.Descripcion,
      partida.CodUnidad,
      partida.RendimientoMO,
      partida.RendimientoEQ
    FROM (
      SELECT DISTINCT
        pp.CodPresupuesto,
        pp.CodSubpresupuesto,
        pp.CodPartida,
        pp.CodPresupuestoPartida,
        pp.Precio1,
        p.Descripcion,
        p.CodUnidad,
        p.RendimientoMO,
        p.RendimientoEQ
      FROM dbo.PresupuestoPartida pp
      INNER JOIN dbo.Partida p
        ON p.CodPartida = pp.CodPartida
       AND p.CodPresupuesto = pp.CodPresupuestoPartida
      WHERE pp.CodPresupuesto = @CodPresupuesto

      UNION

      SELECT DISTINCT
        spd.CodPresupuesto,
        spd.CodSubpresupuesto,
        spd.CodPartida,
        spd.CodPresupuestoPartida,
        spd.Precio1,
        COALESCE(NULLIF(spd.Descripcion, ''), p.Descripcion) AS Descripcion,
        COALESCE(NULLIF(spd.Unidad, ''), p.CodUnidad) AS CodUnidad,
        p.RendimientoMO,
        p.RendimientoEQ
      FROM dbo.SubpresupuestoDetalle spd
      INNER JOIN dbo.Partida p
        ON p.CodPartida = spd.CodPartida
       AND p.CodPresupuesto = spd.CodPresupuestoPartida
      WHERE spd.CodPresupuesto = @CodPresupuesto
        AND spd.CodPartida IS NOT NULL
        AND spd.CodPartida <> '999999999999'
        AND ISNULL(spd.Tipo, 1) <> 0
    ) partida
    ORDER BY partida.CodSubpresupuesto, partida.CodPartida
    FOR JSON PATH
  )) AS partidas,
  JSON_QUERY((
    SELECT
      detalle.CodPresupuesto,
      detalle.CodSubpresupuesto,
      detalle.CodPartida,
      detalle.CodPresupuestoPartida,
      detalle.PropioPartida,
      detalle.CodInsumo,
      detalle.Cantidad,
      detalle.Precio1,
      detalle.Parcial1,
      detalle.Descripcion,
      detalle.CodUnidad,
      detalle.CodIndiceUnificado
    FROM (
      SELECT
        d.CodPresupuesto,
        d.CodSubpresupuesto,
        d.CodPartida,
        d.CodPresupuestoPartida,
        d.PropioPartida,
        d.CodInsumo,
        d.Cantidad,
        d.Precio1,
        CONVERT(numeric(18, 4), ISNULL(d.Cantidad, 0) * ISNULL(d.Precio1, 0)) AS Parcial1,
        i.Descripcion,
        i.CodUnidad,
        i.CodIndiceUnificado
      FROM dbo.PresupuestoPartidaDetalle d
      LEFT JOIN dbo.Insumo i
        ON i.CodInsumo = d.CodInsumo
      WHERE d.CodPresupuesto = @CodPresupuesto

      UNION ALL

      SELECT
        spd.CodPresupuesto,
        spd.CodSubpresupuesto,
        pd.CodPartida,
        pd.CodPresupuesto AS CodPresupuestoPartida,
        pd.PropioPartida,
        pd.CodInsumo,
        pd.Cantidad,
        COALESCE(pi.Precio1, ppi.Precio1) AS Precio1,
        CONVERT(numeric(18, 4), ISNULL(pd.Cantidad, 0) * ISNULL(COALESCE(pi.Precio1, ppi.Precio1), 0)) AS Parcial1,
        i.Descripcion,
        i.CodUnidad,
        i.CodIndiceUnificado
      FROM (
        SELECT DISTINCT
          CodPresupuesto,
          CodSubpresupuesto,
          CodPartida,
          CodPresupuestoPartida,
          PropioPartida
        FROM dbo.SubpresupuestoDetalle
        WHERE CodPresupuesto = @CodPresupuesto
          AND CodPartida IS NOT NULL
          AND CodPartida <> '999999999999'
          AND ISNULL(Tipo, 1) <> 0
      ) spd
      INNER JOIN dbo.Presupuesto pr
        ON pr.CodPresupuesto = spd.CodPresupuesto
      INNER JOIN dbo.PartidaDetalle pd
        ON pd.CodPartida = spd.CodPartida
       AND pd.CodPresupuesto = spd.CodPresupuestoPartida
       AND pd.PropioPartida = spd.PropioPartida
      LEFT JOIN dbo.Insumo i
        ON i.CodInsumo = pd.CodInsumo
      LEFT JOIN dbo.PresupuestoInsumo pi
        ON pi.CodPresupuesto = spd.CodPresupuesto
       AND pi.CodInsumo = pd.CodInsumo
      OUTER APPLY (
        SELECT TOP 1 ppiLookup.Precio1
        FROM dbo.PrecioParticularInsumo ppiLookup
        WHERE ppiLookup.CodPresupuesto = spd.CodPresupuesto
          AND ppiLookup.CodSubpresupuesto = spd.CodSubpresupuesto
          AND ppiLookup.CodInsumo = pd.CodInsumo
        ORDER BY
          CASE
            WHEN ppiLookup.Ano = CONVERT(char(4), YEAR(pr.Fecha))
             AND ppiLookup.Mes = RIGHT('0' + CONVERT(varchar(2), MONTH(pr.Fecha)), 2)
            THEN 0
            ELSE 1
          END,
          ppiLookup.Ano DESC,
          ppiLookup.Mes DESC,
          ppiLookup.Precio1 ASC
      ) ppi
      WHERE NOT EXISTS (
          SELECT 1
          FROM dbo.PresupuestoPartidaDetalle existing
          WHERE existing.CodPresupuesto = @CodPresupuesto
        )
    ) detalle
    ORDER BY detalle.CodSubpresupuesto, detalle.CodPartida, detalle.CodInsumo
    FOR JSON PATH
  )) AS apuDetalles,
  JSON_QUERY((
    SELECT
      CodPresupuesto,
      CodSubpresupuesto,
      Linea,
      Descripcion,
      Variable,
      Formula,
      Omitido
    FROM dbo.PieSubpresupuesto
    WHERE CodPresupuesto = @CodPresupuesto
    ORDER BY CodSubpresupuesto, Linea
    FOR JSON PATH
  )) AS pieSubpresupuestos,
  JSON_QUERY((
    SELECT
      CodPresupuesto,
      CodSubpresupuesto,
      Linea,
      Descripcion,
      Formula,
      Valor1,
      Valor2,
      ValorConFactor
    FROM dbo.ResultadoPieSubpresupuesto
    WHERE CodPresupuesto = @CodPresupuesto
    ORDER BY CodSubpresupuesto, Linea
    FOR JSON PATH
  )) AS resultadoPieSubpresupuestos
FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
