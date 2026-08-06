import plotly.express as px
import plotly.graph_objects as go
import pandas as pd


def net_worth_projection_chart(projection: pd.DataFrame, fire_number: float) -> go.Figure:
    fig = px.line(
        projection,
        x="year",
        y="portfolio",
        markers=True,
        title="Projected Portfolio Growth",
    )
    fig.add_hline(
        y=fire_number,
        line_dash="dash",
        line_color="#d62728",
        annotation_text="FIRE target",
        annotation_position="top left",
    )
    fig.update_layout(yaxis_title="Portfolio Value ($)", xaxis_title="Year")
    return fig


def expense_donut_chart(expense_summary: pd.DataFrame) -> go.Figure:
    if expense_summary.empty:
        fig = go.Figure()
        fig.update_layout(title="Expense Breakdown (No expense data yet)")
        return fig

    return px.pie(
        expense_summary,
        values="expense",
        names="category",
        hole=0.55,
        title="Expense Breakdown by Category",
    )


def cashflow_waterfall_chart(
    annual_after_tax_income: float,
    annual_expenses: float,
    annual_529: float,
    annual_retirement_investing: float,
    annual_net_rental_cashflow: float,
) -> go.Figure:
    measures = ["relative", "relative", "relative", "relative", "total"]
    labels = [
        "After-Tax Income",
        "Living Expenses",
        "529 Contributions",
        "Retirement Investing",
        "Estimated Annual Net",
    ]
    values = [
        annual_after_tax_income + annual_net_rental_cashflow,
        -annual_expenses,
        -annual_529,
        -annual_retirement_investing,
        0,
    ]

    fig = go.Figure(
        go.Waterfall(
            measure=measures,
            x=labels,
            y=values,
            connector={"line": {"color": "#8a8a8a"}},
        )
    )

    fig.update_layout(
        title="Cash Flow Waterfall (Annual)",
        yaxis_title="Amount ($)",
        showlegend=False,
    )
    return fig
