import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Read wide-format CSV
# Example format:
# Horizontal,Vertical
# 200,300
# 400,2100
df = pd.read_csv("data.csv")

sns.kdeplot(
    data=df,
    fill=True,
    common_norm=False,
    bw_adjust=0.8,
    clip=(0, None),
    alpha=0.35
)

plt.xlabel("Reaction Time (ms)")
plt.ylabel("Density")
plt.title("Reaction Time Distribution")
plt.xlim(left=0)
plt.tight_layout()
plt.show()
