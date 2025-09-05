using AutoMapper;
using TraceNet.DTOs;
using TraceNet.Models;

namespace TraceNet.Infrastructure
{
    /// <summary>
    /// AutoMapper profile for converting cable connection entities into DTOs.
    /// Maps the composite entity CableConnection (Cable + FromPort + ToPort) 
    /// into a flat structure CableDto for easier frontend consumption.
    /// </summary>
    public class CableProfile : Profile
    {
        public CableProfile()
        {
            // CableConnection is a composite entity that includes Cable, FromPort, and ToPort
            // CableDto is a flattened structure optimized for frontend usage
            CreateMap<CableConnection, CableDto>()
                
                // Basic cable information (from Cable entity)
                .ForMember(dest => dest.CableId, opt => opt.MapFrom(src => src.Cable.CableId))
                .ForMember(dest => dest.Description, opt => opt.MapFrom(src => src.Cable.Description))
                
                // Source information (FromPort → Device path)
                .ForMember(dest => dest.FromDevice, opt => opt.MapFrom(src => src.FromPort.Device.Name))
                .ForMember(dest => dest.FromPort, opt => opt.MapFrom(src => src.FromPort.Name))
                .ForMember(dest => dest.FromDeviceId, opt => opt.MapFrom(src => src.FromPort.Device.DeviceId))
                
                // Destination information (ToPort → Device path)
                .ForMember(dest => dest.ToDevice, opt => opt.MapFrom(src => src.ToPort.Device.Name))
                .ForMember(dest => dest.ToPort, opt => opt.MapFrom(src => src.ToPort.Name))
                .ForMember(dest => dest.ToDeviceId, opt => opt.MapFrom(src => src.ToPort.Device.DeviceId));
        }
    }

    /*
     * Mapping structure overview:
     * 
     * [Database]
     * CableConnection
     * ├── Cable (cable details)
     * │   ├── CableId
     * │   └── Description ...
     * ├── FromPort (source port)
     * │   ├── Name
     * │   └── Device
     * │       ├── Name
     * │       └── DeviceId ...
     * └── ToPort (destination port)
     *     ├── Name
     *     └── Device
     *         ├── Name
     *         └── DeviceId ...
     * 
     * [API Response]
     * CableDto 
     * ├── CableId, Description
     * ├── FromDevice, FromPort, FromDeviceId
     * └── ToDevice, ToPort, ToDeviceId
     * 
     * → Allows frontend to access data directly without nested object traversal
     */
}
