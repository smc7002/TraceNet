using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceRackAndIpAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IPAddress",
                table: "Devices",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RackId",
                table: "Devices",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Rack",
                columns: table => new
                {
                    RackId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rack", x => x.RackId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Devices_RackId",
                table: "Devices",
                column: "RackId");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Rack_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Rack",
                principalColumn: "RackId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Rack_RackId",
                table: "Devices");

            migrationBuilder.DropTable(
                name: "Rack");

            migrationBuilder.DropIndex(
                name: "IX_Devices_RackId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "IPAddress",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "RackId",
                table: "Devices");
        }
    }
}
